"use client";

import { Suspense, use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { doc, onSnapshot, runTransaction } from "firebase/firestore";
import { MultiplayerProvider, useMultiplayerTournament } from "@/context/MultiplayerContext";
import { db } from "@/lib/firebase";
import { replayBestOf, validSeriesProgress } from "@/lib/replaySeries.mjs";
import { advanceMultiplayerVeto, createMultiplayerVeto, validMultiplayerVeto, vetoDocId } from "@/lib/multiplayerVeto.mjs";
import HybridMatchPlayer from "@/components/HybridMatchPlayer";

function useRoomVeto({ enabled, roomId, tournamentId, matchId, matchIndex, bestOf, playerTeam }) {
  const vetoSeed = `${roomId}:${tournamentId}:${matchId}:veto`;
  const ref = useMemo(() => enabled ? doc(db, "rooms", roomId, "vetos", vetoDocId(tournamentId, matchId)) : null,
    [enabled, roomId, tournamentId, matchId]);
  const [shared, setShared] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!ref) return;
    let active = true;
    let initializing = false;
    const unsubscribe = onSnapshot(ref, { includeMetadataChanges: true }, snapshot => {
      if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (!validMultiplayerVeto(data, tournamentId, matchId, matchIndex, bestOf)) {
          setError("The shared veto could not be read.");
          return;
        }
        setShared(data);
        setError("");
      } else if (!initializing) {
        initializing = true;
        runTransaction(db, async tx => {
          if (!(await tx.get(ref)).exists()) {
            tx.set(ref, createMultiplayerVeto(tournamentId, matchId, matchIndex, bestOf, vetoSeed, Date.now()));
          }
        }).catch(err => { if (active) setError(err.message); });
      }
    }, err => { if (active) setError(err.message); });
    return () => { active = false; unsubscribe(); };
  }, [ref, tournamentId, matchId, matchIndex, bestOf, vetoSeed, retry]);

  const update = useCallback((actionIndex, map) => runTransaction(db, async tx => {
    const snapshot = await tx.get(ref);
    const data = snapshot.data();
    if (!validMultiplayerVeto(data, tournamentId, matchId, matchIndex, bestOf)) throw new Error("The shared veto could not be read.");
    const next = advanceMultiplayerVeto(data, { actionIndex, playerTeam, map, now: Date.now(), vetoSeed });
    if (next) tx.update(ref, { veto: next.veto, turnDeadlineMs: next.turnDeadlineMs });
  }), [ref, tournamentId, matchId, matchIndex, bestOf, playerTeam, vetoSeed]);

  const actionIndex = shared?.veto.actions.length;
  const deadline = shared?.turnDeadlineMs;
  useEffect(() => {
    if (!ref || deadline == null) return;
    let active = true;
    let timer;
    const expire = async () => {
      if (Date.now() < deadline) {
        timer = setTimeout(expire, deadline - Date.now());
        return;
      }
      try { await update(actionIndex); }
      catch (err) {
        if (!active) return;
        setError(err.message);
        timer = setTimeout(expire, 2_000);
      }
    };
    timer = setTimeout(expire, Math.max(0, deadline - Date.now()));
    return () => { active = false; clearTimeout(timer); };
  }, [ref, deadline, actionIndex, update]);

  return { veto: shared?.veto, turnDeadlineMs: deadline ?? null, error, busy,
    retry: () => { setShared(null); setError(""); setRetry(value => value + 1); },
    onChoose: async map => {
      if (!ref || busy) return;
      setBusy(true);
      setError("");
      try { await update(actionIndex, map); }
      catch (err) { setError(err.message); }
      finally { setBusy(false); }
    } };
}

function RoomReplay({ match, matchIndex, roomId, tournamentId, userUid, completeMatch, playbackMode, playbackSpeed, simulation }) {
  const key = `major-mvp:room-replay:${roomId}:${tournamentId}:${match.id}:${userUid}`;
  const backHref = `/room/${roomId}/simulation`;
  const isPvp = match.playerUids?.length === 2;
  const playerTeam = match.teamA.uid === userUid ? 'A' : 'B';
  const shared = useRoomVeto({ enabled: isPvp && !match.completed, roomId, tournamentId,
    matchId: match.id, matchIndex, bestOf: replayBestOf(match), playerTeam });
  const [error, setError] = useState("");
  const [resume] = useState(() => {
    try {
      const raw = typeof window !== "undefined" ? sessionStorage.getItem(key) : null;
      if (raw === null) return null;
      const data = JSON.parse(raw);
      return validSeriesProgress(match, data) ? data : { invalid: true };
    } catch { return { invalid: true }; }
  });
  const save = useCallback(progress => {
    try { sessionStorage.setItem(key, JSON.stringify(progress)); }
    catch { setError("Your playback position could not be saved in this tab."); }
  }, [key]);
  if (isPvp && !shared.veto && !match.completed) return <main className="p-6">
    {shared.error ? <><p role="alert">{shared.error}</p>
      <button type="button" className="btn btn-secondary mt-4" onClick={shared.retry}>Try again</button></>
      : <p role="status">Loading map veto…</p>}
    <Link href={backHref} className="link mt-2 block">Back to the Major</Link>
  </main>;
  if (!isPvp && resume?.invalid && !match.completed) return <main className="p-6"><p role="alert">The saved progress for this match could not be read.</p>
    <button type="button" className="btn btn-secondary mt-4" onClick={() => { sessionStorage.removeItem(key); window.location.reload(); }}>Restart playback</button></main>;
  // A legacy PvP replay may have started before map order became shared.
  const syncedResume = shared.veto && resume?.vetoStarted && shared.veto.firstTeam === resume.veto.firstTeam &&
    shared.veto.actions.length === resume.veto.actions.length &&
    shared.veto.actions.every((action, index) => action.map === resume.veto.actions[index].map);
  return <>{error && <p role="alert" className="p-4 text-negative">{error}</p>}
    <HybridMatchPlayer match={match} simulation={simulation} playbackMode={playbackMode} allowShortcuts={false} tournamentId={`${roomId}:${tournamentId}`}
      playbackSpeed={playbackSpeed} isMultiplayer={true}
      initialProgress={isPvp ? (syncedResume ? resume : null) : resume} onSaveProgress={save}
      vetoPlayer={isPvp || match.playerUids?.length === 1 ? playerTeam : null} pvpVeto={isPvp ? shared : null}
      backHref={backHref} onFinish={async result => {
        const accepted = await completeMatch(match.id, result);
        try { sessionStorage.removeItem(key); } catch { /* A completed match no longer uses its saved playback. */ }
        return accepted;
      }} />
  </>;
}

function MatchContent({ roomId }) {
  const searchParams = useSearchParams();
  const { matches, completeMatch, tournamentId, userUid, matchesStarted, playbackMode, playbackSpeed, simulation } = useMultiplayerTournament();
  const matchIndex = matches.findIndex(item => item.id === searchParams.get("id"));
  const match = matches[matchIndex];
  if (!match || !match.playerUids?.includes(userUid) || (!matchesStarted && !match.completed)) return <main className="p-6">
    <p>You have no match to play this round.</p>
    <Link href={`/room/${roomId}/simulation`} className="link mt-2 inline-block underline">Back to the Major</Link></main>;
  return <RoomReplay key={`${tournamentId}:${match.id}:${userUid}`} match={match} matchIndex={matchIndex} roomId={roomId}
    tournamentId={tournamentId} userUid={userUid} completeMatch={completeMatch} playbackMode={playbackMode} playbackSpeed={playbackSpeed} simulation={simulation} />;
}

export default function MatchPage({ params }) {
  const roomId = use(params).id;
  return <MultiplayerProvider roomId={roomId}><Suspense fallback={<p className="p-6 text-ink-2">Loading match…</p>}>
    <MatchContent roomId={roomId} />
  </Suspense></MultiplayerProvider>;
}
