"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { collection, doc, getDoc, limit, onSnapshot, query, where } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { decodeRoom } from "@/lib/roomStorage.mjs";
import { clearRoomSession, getPageSession, readRoomSession, roomSessionExpired, roomSessionsNeedReconciliation, SESSION_HEARTBEAT_MS } from "@/lib/roomSession.mjs";
import { heartbeatRoomSession, leaveRoom, markRoomSessionLeaving, reconcileRoomSessions } from "@/lib/roomService";

const RoomSessionContext = createContext(null);
const insideRoom = (path, roomId) => path === `/room/${roomId}` || path.startsWith(`/room/${roomId}/`);

export function RoomSessionProvider({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const uid = user?.uid;
  const [initialized, setInitialized] = useState(false);
  const [otherTab, setOtherTab] = useState(false);
  const pathname = usePathname() || "";
  const [entry, setEntry] = useState(null);
  const [room, setRoom] = useState(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const entered = useRef(false);
  const leaving = useRef(false);
  const pathRef = useRef(pathname);
  useEffect(() => { pathRef.current = pathname; }, [pathname]);
  const activeMajor = room?.status === "playing" && room.tournament?.stage !== "won" && room.tournament?.participantUids?.includes(uid) && room.players?.some(p => p.uid === uid && !p.left);
  const majorRef = useRef(false);
  useEffect(() => { majorRef.current = !!activeMajor; }, [activeMajor]);

  useEffect(() => {
    function sync() {
      try {
        const stored = readRoomSession();
        const current = getPageSession();
        entered.current = false;
        if (stored?.pageId === current.pageId) { leaving.current = false; setOtherTab(false); }
        else setRoom(null);
        setEntry(stored?.pageId === current.pageId ? stored : null);
      } catch (err) { setError(err.message || "Could not read your room session."); }
    }
    window.addEventListener("major-mvp-room-session", sync);
    sync();
    return () => window.removeEventListener("major-mvp-room-session", sync);
  }, []);

  useEffect(() => {
    if (!uid || typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel("room-session");
    channel.onmessage = event => {
      const data = event.data;
      if (data?.type === "ping" && data.uid === uid && data.pageId === getPageSession().pageId) {
        channel.postMessage({ type: "pong", uid, pageId: data.pageId, nonce: data.nonce });
      }
    };
    return () => channel.close();
  }, [uid]);

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    async function initialize() {
      try {
        if (!uid) return;
        const stored = readRoomSession();
        const snapshot = await getDoc(doc(db, "roomSessions", uid));
        if (cancelled) return;
        const claim = snapshot.data();
        if (!claim) {
          if (stored && readRoomSession()?.pageId === stored.pageId) clearRoomSession();
          return;
        }
        const expired = roomSessionExpired(claim);
        if (stored && stored.roomId === claim.roomId && stored.pageId === claim.pageId && stored.tabId === claim.tabId && stored.pageId !== getPageSession().pageId) {
          const navigationType = performance.getEntriesByType("navigation")[0]?.type;
          // A duplicated tab can copy sessionStorage while the original is too busy to answer.
          if (!expired && !["reload", "back_forward"].includes(navigationType)) { setOtherTab(true); return; }
          let originalAlive;
          if (typeof BroadcastChannel === "undefined") {
            const navigation = performance.getEntriesByType("navigation")[0];
            originalAlive = !["reload", "back_forward"].includes(navigation?.type);
          } else {
            originalAlive = await new Promise(resolve => {
              const channel = new BroadcastChannel("room-session");
              const nonce = crypto.randomUUID();
              const timer = setTimeout(() => { channel.close(); resolve(false); }, 200);
              channel.onmessage = event => {
                const data = event.data;
                if (data?.type === "pong" && data.uid === uid && data.pageId === claim.pageId && data.nonce === nonce) {
                  clearTimeout(timer); channel.close(); resolve(true);
                }
              };
              channel.postMessage({ type: "ping", uid, pageId: claim.pageId, nonce });
            });
          }
          if (cancelled) return;
          if (originalAlive) { setOtherTab(true); return; }
          const prior = await getDoc(doc(db, "rooms", claim.roomId));
          const previous = prior.exists() ? decodeRoom(prior.data()) : null;
          const forfeited = previous?.status === "playing" && previous.tournament?.stage !== "won" && previous.players?.some(p => p.uid === uid && p.participating && !p.left);
          await leaveRoom(claim.roomId, uid, "reload", claim.pageId);
          if (!cancelled) { setNotice(forfeited ? "You left the room when the page was reloaded and forfeited the Major." : "You left the room when the page was reloaded."); router.replace("/multiplayer"); }
        } else if (expired) {
          await reconcileRoomSessions(claim.roomId);
          if (stored?.pageId === claim.pageId && readRoomSession()?.pageId === stored.pageId) clearRoomSession();
        } else if (claim.pageId !== getPageSession().pageId) setOtherTab(true);
      } catch (err) { if (!cancelled) setError(err.message || "Could not check your room session."); }
      finally { if (!cancelled) setInitialized(true); }
    }
    initialize();
    return () => { cancelled = true; };
  }, [loading, uid, router]);

  useEffect(() => {
    if (!entry || !uid) return;
    let stopped = false;
    let sessions = null;
    let reconciling = null;
    const report = err => { if (!stopped) setError(err.message || "Could not update the room session."); };
    const heartbeat = () => heartbeatRoomSession(uid, entry.pageId).catch(report);
    const reconcile = () => {
      if (!reconciling) reconciling = reconcileRoomSessions(entry.roomId).catch(report).finally(() => { reconciling = null; });
      return reconciling;
    };
    const checkSessions = () => {
      if (roomSessionsNeedReconciliation(sessions)) reconcile();
    };
    heartbeat();
    reconcile();
    const heartTimer = setInterval(heartbeat, SESSION_HEARTBEAT_MS);
    // Check elapsed leases even when no peer sends another snapshot after a crash.
    const reconcileTimer = setInterval(checkSessions, 30000);
    let ended = false;
    function endSession(message) {
      if (stopped || ended || leaving.current) return;
      ended = true;
      leaving.current = true;
      try {
        if (readRoomSession()?.pageId === entry.pageId) clearRoomSession();
        setNotice(message);
        router.replace("/multiplayer");
      } catch (err) { report(err); }
    }
    const unsubscribeRoom = onSnapshot(doc(db, "rooms", entry.roomId), snapshot => {
      if (stopped) return;
      const data = snapshot.exists() ? decodeRoom(snapshot.data()) : null;
      setRoom(data);
      if (!data || data.status === "closed") endSession("This room was closed. You have returned to multiplayer.");
      else if (!data.players?.some(p => p.uid === uid && !p.left)) endSession("You have left this room. An active Major may have been forfeited.");
    }, report);
    const unsubscribeOwn = onSnapshot(doc(db, "roomSessions", uid), snapshot => {
      if (!snapshot.metadata.fromCache && (!snapshot.exists() || snapshot.data().pageId !== entry.pageId)) endSession("Your room session ended. You have returned to multiplayer.");
    }, report);
    const unsubscribePeers = onSnapshot(query(collection(db, "roomSessions"), where("roomId", "==", entry.roomId), limit(8)), { includeMetadataChanges: true }, snapshot => {
      if (stopped) return;
      sessions = snapshot.metadata.fromCache ? null : snapshot.docs.map(item => item.data());
      checkSessions();
    }, err => { sessions = null; if (!ended) report(err); });
    return () => { stopped = true; clearInterval(heartTimer); clearInterval(reconcileTimer); unsubscribeRoom(); unsubscribeOwn(); unsubscribePeers(); };
  }, [entry, uid, router]);

  useEffect(() => {
    if (!entry || !uid) return;
    if (insideRoom(pathname, entry.roomId)) { entered.current = true; return; }
    if (!entered.current || leaving.current) return;
    leaving.current = true;
    leaveRoom(entry.roomId, uid, "navigation", entry.pageId).catch(err => setError(err.message || "Could not leave the room.")).finally(() => { leaving.current = false; });
  }, [entry, pathname, uid]);

  useEffect(() => {
    if (!entry || !uid) return;
    function click(event) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || leaving.current || !entered.current) return;
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!anchor || anchor.hasAttribute("download") || (anchor.target && anchor.target !== "_self")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin === window.location.origin && insideRoom(url.pathname, entry.roomId)) return;
      event.preventDefault();
      event.stopPropagation();
      if (majorRef.current && !window.confirm("Leaving will forfeit this Major. Continue?")) return;
      leaving.current = true;
      leaveRoom(entry.roomId, uid, "navigation", entry.pageId).then(() => {
        if (url.origin === window.location.origin) router.push(url.pathname + url.search + url.hash);
        else window.location.assign(url.href);
      }).catch(err => { setError(err.message || "Could not leave the room."); leaving.current = false; });
    }
    function beforeUnload(event) {
      if (majorRef.current && !leaving.current) { event.preventDefault(); event.returnValue = ""; }
    }
    function pageHide() {
      if (!leaving.current && insideRoom(pathRef.current, entry.roomId)) markRoomSessionLeaving(uid, entry.pageId);
    }
    document.addEventListener("click", click, true);
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("pagehide", pageHide);
    return () => { document.removeEventListener("click", click, true); window.removeEventListener("beforeunload", beforeUnload); window.removeEventListener("pagehide", pageHide); };
  }, [entry, uid, router]);

  return <RoomSessionContext.Provider value={{ entry, notice, error, room, activeMajor: !!activeMajor, userUid: uid }}>
    {notice && <div role="status" className="px-4 py-2 text-ink-2">{notice} <button type="button" className="link underline" onClick={() => setNotice("")}>Dismiss</button></div>}
    {error && <div role="alert" className="px-4 py-2 text-negative">{error} <button type="button" className="link underline" onClick={() => setError("")}>Dismiss</button></div>}
    {!initialized ? <main className="p-6 text-ink-2">Checking room session?</main> : /^\/room\/[^/]+/.test(pathname) && (!entry || !insideRoom(pathname, entry.roomId)) ? <main className="p-6">{otherTab ? "This room is active in another tab. " : "You do not have an active session in this room. "}<a href="/multiplayer" className="link underline">Return to multiplayer.</a></main> : children}
  </RoomSessionContext.Provider>;
}

export const useRoomSession = () => useContext(RoomSessionContext);
