"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AppBar from "@/components/AppBar";
import { useAuth } from "@/context/AuthContext";
import { useTournament } from "@/context/TournamentContext";
import { createRoom, joinRoom, listPublicRooms } from "@/lib/roomService";
import { validOrganization } from "@/lib/localCareer.mjs";

export default function MultiplayerPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { organization, ready, storageError, rosterLocked } = useTournament();
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [roomName, setRoomName] = useState(null);
  const [isPublic, setIsPublic] = useState(true);
  const [playbackMode, setPlaybackMode] = useState("highlights");
  const [rooms, setRooms] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [refreshing, setRefreshing] = useState(true);

  useEffect(() => {
    if (loading || !user) return;
    let active = true;
    listPublicRooms().then(result => { if (active) setRooms(result); })
      .catch(err => { if (active) setError(err.message || "Public rooms could not be loaded."); })
      .finally(() => { if (active) setRefreshing(false); });
    return () => { active = false; };
  }, [loading, user]);

  async function enter(code) {
    if (!user) return setError("You could not be signed in. Reload the page to try again.");
    if (!validOrganization(organization) || organization.squad.length !== 5) return setError("You need a complete organization to join a room.");
    if (rosterLocked || storageError) return setError("Finish your current Major and save your organization before joining a room.");
    if (code !== null && !/^[A-Z0-9]{4}$/.test(code.trim().toUpperCase())) return setError("Room codes are 4 letters or numbers.");
    setError("");
    setBusy(code === null ? "create" : code);
    try {
      const displayName = name.trim() || user.displayName || organization.name;
      const joinedCode = code === null
        ? await createRoom(user.uid, displayName, organization, isPublic ? "public" : "private", playbackMode, roomName)
        : await joinRoom(code.trim().toUpperCase(), user.uid, displayName, organization);
      router.push(`/room/${joinedCode}`);
    } catch (err) {
      setError(err.message || "Could not join the room.");
      setBusy("");
    }
  }

  async function refresh() {
    setRefreshing(true); setError("");
    try { setRooms(await listPublicRooms()); }
    catch (err) { setError(err.message); }
    finally { setRefreshing(false); }
  }

  if (loading || !ready) return <><AppBar /><main className="p-6 text-ink-2">Connecting…</main></>;
  if (!user) return <><AppBar /><main className="p-6" role="alert">You could not be signed in. Reload the page to try again.</main></>;
  if (!organization) return <><AppBar />
    <main className="mx-auto w-full max-w-[1440px] px-4 py-16 sm:px-6">
      <h1 className="text-[24px] font-medium">Multiplayer</h1>
      <p className="mt-2 max-w-[520px] text-ink-2">{storageError || "You need an organization to play with friends. Draft your squad first, then come back to create or join a room."}</p>
      <Link href="/play" className="btn btn-primary btn-lg mt-6">Create organization</Link>
    </main></>;

  return <>
    <AppBar />
    <main className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6">
      <h1 className="text-[20px] font-medium">Multiplayer</h1>
      <p className="mt-1 max-w-[640px] text-ink-2">You play as {organization.name}. Your organization stays on this device; when you mark yourself ready, the room gets a copy of it.</p>
      {error && <p role="alert" className="mt-4 text-negative">{error}</p>}

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="grid content-start gap-4">
          <section className="card p-6" aria-labelledby="create-title">
            <h2 id="create-title" className="text-[16px] font-medium">Create a room</h2>
            <label className="mt-4 block" htmlFor="room-name"><span className="label">Room name</span></label>
            <input id="room-name" value={roomName ?? `${organization.name}'s Room`.slice(0, 35)} onChange={e => setRoomName(e.target.value)} maxLength={35} disabled={!!busy} className="field" />
            <label className="mt-4 block" htmlFor="nickname"><span className="label">Display name (optional)</span></label>
            <input id="nickname" value={name} onChange={e => setName(e.target.value)} placeholder={user.displayName || organization.name} maxLength={15} className="field" />
            <fieldset className="mt-4">
              <legend className="label">Match playback</legend>
              <div className="mt-2 flex gap-2">{[["highlights", "Highlights"], ["full", "Full match"]].map(([mode, label]) =>
                <button key={mode} type="button" aria-pressed={playbackMode === mode} onClick={() => setPlaybackMode(mode)} disabled={!!busy}
                  className={`btn btn-secondary flex-1 border ${playbackMode === mode ? "border-white" : "border-transparent"}`}>{label}</button>
              )}</div>
            </fieldset>
            <label className="mt-4 flex items-center gap-2 text-ink-2">
              <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} className="accent-[var(--ink)]" />
              List it in public rooms
            </label>
            <button type="button" onClick={() => enter(null)} disabled={!!busy} className="btn btn-primary mt-6">{busy === "create" ? "Creating…" : "Create room"}</button>
          </section>

          <section className="card p-6" aria-labelledby="join-title">
            <h2 id="join-title" className="text-[16px] font-medium">Join with a code</h2>
            <form className="mt-4 flex gap-2" onSubmit={e => { e.preventDefault(); enter(roomCode); }}>
              <input aria-label="Room code" value={roomCode} onChange={e => setRoomCode(e.target.value.toUpperCase())} placeholder="ABCD" maxLength={4}
                className="field tabular w-32 tracking-[0.2em]" autoComplete="off" />
              <button type="submit" disabled={!!busy} className="btn btn-secondary">Join</button>
            </form>
          </section>
        </div>

        <section className="card p-6" aria-labelledby="rooms-title">
          <div className="flex items-center justify-between gap-4">
            <h2 id="rooms-title" className="text-[16px] font-medium">Public rooms</h2>
            <button type="button" disabled={refreshing} onClick={refresh} className="link text-[13px] disabled:opacity-40">Refresh</button>
          </div>
          {refreshing ? <p className="mt-4 text-ink-2">Loading rooms…</p> : rooms.length === 0 ? <p className="mt-4 text-ink-2">No public rooms right now. Create one and share its code.</p> : (
            <ul className="mt-2">{rooms.map(room => (
              <li key={room.id} className="flex min-h-16 items-center gap-4 border-t border-rule py-2 first:border-t-0">
                <div className="min-w-0 flex-1">
                  <p className="break-words font-medium">{room.name || room.id}</p>
                  <p className="meta">{room.id} · {room.players?.length || 0} of 8 players · {room.playbackMode === "highlights" ? "Highlights" : "Full match"}</p>
                </div>
                <button type="button" onClick={() => enter(room.id)} disabled={!!busy} className="btn btn-secondary">Join</button>
              </li>
            ))}</ul>
          )}
        </section>
      </div>
    </main>
  </>;
}
