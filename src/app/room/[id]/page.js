"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import AppBar from "@/components/AppBar";
import PlayerIdentity from "@/components/PlayerIdentity";
import RoomRolesDialog from "@/components/RoomRolesDialog";
import { useAuth } from "@/context/AuthContext";
import { useTournament } from "@/context/TournamentContext";
import { validOrganization } from "@/lib/localCareer.mjs";
import { leaveRoom, setRoomParticipation, setRoomReady, startRoomMajor } from "@/lib/roomService";
import { ROLE_FIELDS } from "@/lib/majorDisplay.mjs";
import { decodeRoom } from "@/lib/roomStorage.mjs";

export default function RoomPage({ params }) {
  const roomId = use(params).id;
  const router = useRouter();
  const { user, loading } = useAuth();
  const { organization, ready, assignOrganizationRole } = useTournament();
  const [room, setRoom] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    if (loading || !user) return;
    return onSnapshot(doc(db, "rooms", roomId), snapshot => {
      if (!snapshot.exists()) { setError("This room doesn't exist or was closed."); setRoom(null); return; }
      const data = decodeRoom(snapshot.data());
      setRoom(data);
      if (data.status === "playing" && data.tournament?.participantUids?.includes(user.uid)) router.push(`/room/${roomId}/simulation`);
    }, err => setError(err.message || "Could not connect to the room."));
  }, [roomId, user, loading, router]);

  async function run(action, operation) {
    setBusy(action);
    setError("");
    try { await operation(); }
    catch (err) { setError(err.message || "That didn't work. Try again."); }
    finally { setBusy(""); }
  }

  const back = <Link href="/multiplayer" className="link mt-2 inline-block underline">Back to multiplayer</Link>;
  if (loading || !ready) return <><AppBar /><main className="p-6 text-ink-2">Loading room…</main></>;
  if (!user) return <><AppBar /><main className="p-6" role="alert">You could not be signed in. Reload the page to try again. {back}</main></>;
  if (!room) return <><AppBar /><main className="p-6"><p>{error || "Loading room…"}</p>{back}</main></>;

  if (room.status === "closed") return <><AppBar /><main className="p-6"><p>This room has been closed.</p>{back}</main></>;

  const players = room.players || [];
  const me = players.find(p => p.uid === user.uid && !p.left);
  const isHost = room.hostId === user.uid;
  const included = players.filter(p => p.participating && !p.left);
  const canStart = included.length > 0 && included.every(p => p.isReady);
  const inLobby = room.status === "lobby";
  const canReady = validOrganization(organization) && organization.squad.length === 5;

  return <>
    <AppBar />
    <main className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-medium break-words">{room.name || `Room ${roomId}`}</h1>
          <p className="meta mt-2">Room code: <span className="tabular tracking-[0.1em]">{roomId}</span></p>
          <p className="meta mt-2">{room.playbackMode === "highlights" ? "Highlights · one third of rounds, rounded up. All rounds count." : "Full match · every round."}</p>
          <p className="mt-1 text-ink-2">{inLobby ? "Share the code. The host starts the Major once everyone taking part is ready." : "A Major is being played in this room."}</p>
        </div>
        {me && inLobby && <button type="button" disabled={!!busy} className="link disabled:opacity-40"
          onClick={() => run("leave", async () => { await leaveRoom(roomId, user.uid); router.push("/multiplayer"); })}>
          {busy === "leave" ? "Leaving…" : "Leave room"}
        </button>}
      </header>
      {error && <p role="alert" className="mt-4 text-negative">{error}</p>}
      {!me && <p role="alert" className="mt-4">You are no longer in this room. {back}</p>}

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section className="card p-6" aria-labelledby="orgs-title">
          <div className="flex items-baseline justify-between">
            <h2 id="orgs-title" className="text-[16px] font-medium">Organizations</h2>
            <span className="meta tabular">{players.filter(p => !p.left).length} of 8</span>
          </div>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">{players.map(p => {
            const org = p.organization;
            const playing = room.status === "playing" && room.tournament?.participantUids?.includes(p.uid);
            const state = p.left ? "Left the Major" : !p.participating ? "Sitting out" : playing ? "In the Major" : p.isReady ? "Ready" : "Getting ready";
            return <li key={p.uid} className="rounded-xl bg-raised p-4">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {org?.icon && <img src={org.icon} alt="" width="40" height="40" className="object-contain" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{org?.name || p.teamName}</p>
                  <p className="meta truncate">{p.name}{p.uid === user.uid ? " · you" : ""}{p.uid === room.hostId ? " · host" : ""}</p>
                </div>
                <span className={`flex items-center gap-2 text-[13px] ${p.isReady && p.participating ? "text-ink" : "text-ink-2"}`}>
                  <span className="h-1.5 w-1.5 rounded-full" aria-hidden="true" style={{ background: p.isReady && p.participating ? "var(--positive)" : "var(--ink-3)" }} />
                  {state}
                </span>
              </div>
              {org?.squad && <ul className="mt-3 grid gap-1 text-[13px]">{org.squad.map((entry, i) => {
                const tags = Object.entries(ROLE_FIELDS).filter(([field]) => org[field] === String(i)).map(([, label]) => label);
                return <li key={i} className="flex justify-between gap-2"><PlayerIdentity player={entry.player} /><span className="shrink-0 text-ink-3">{tags.join(" · ")}</span></li>;
              })}</ul>}
              {isHost && inLobby && !p.left && <button type="button" disabled={!!busy} className="link mt-3 text-[13px] underline disabled:opacity-40"
                onClick={() => run(`participation-${p.uid}`, () => setRoomParticipation(roomId, user.uid, p.uid, !p.participating))}>
                {p.participating ? "Leave out of the next Major" : "Include in the next Major"}
              </button>}
            </li>;
          })}</ul>
        </section>

        <div className="grid content-start gap-4">
          {me && inLobby && <section className="card p-6" aria-labelledby="you-title">
            <h2 id="you-title" className="text-[16px] font-medium">Your organization</h2>
            <p className="mt-1 text-ink-2">It lives on this device. Marking yourself ready shares its current roster and roles with the room.</p>
            {!canReady && <p className="mt-2 text-negative">Your organization needs a full roster and valid roles before you can be ready.</p>}
            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" disabled={!!busy || !me.participating || (!me.isReady && !canReady)} className="btn btn-primary"
                onClick={() => run("ready", () => setRoomReady(roomId, user.uid, organization, !me.isReady))}>
                {busy === "ready" ? "Saving…" : me.isReady ? "Not ready" : "I'm ready"}
              </button>
              <RoomRolesDialog organization={organization} assignRole={assignOrganizationRole} disabled={!!busy}
                onOpen={async () => { if (me.isReady) await setRoomReady(roomId, user.uid, organization, false); }}
                onDone={() => setRoomReady(roomId, user.uid, organization, false)} />
            </div>
          </section>}

          {isHost && inLobby && <section className="card p-6" aria-labelledby="host-title">
            <h2 id="host-title" className="text-[16px] font-medium">Host</h2>
            <p className="mt-1 text-ink-2">{canStart ? "Everyone taking part is ready." : "Everyone taking part has to be ready first."}</p>
            <button type="button" disabled={!!busy || !canStart} className="btn btn-primary btn-lg mt-6"
              onClick={() => run("start", () => startRoomMajor(roomId, user.uid))}>{busy === "start" ? "Starting…" : "Start Major"}</button>
          </section>}

          {room.status === "playing" && <Link href={`/room/${roomId}/simulation`} className="btn btn-primary self-start">Watch the Major</Link>}
          {inLobby && room.lastMajor && room.tournament && <Link href={`/room/${roomId}/simulation?results=1`} prefetch={false} className="link underline">See the last Major&apos;s results</Link>}
        </div>
      </div>
    </main>
  </>;
}
