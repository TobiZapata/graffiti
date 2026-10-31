"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useTournament } from "@/context/TournamentContext";
import { validOrganization } from "@/lib/localCareer.mjs";
import { leaveRoom, setRoomParticipation, setRoomReady, startRoomMajor } from "@/lib/roomService";

const roles = { mainAwperUid: "AWP", iglUid: "IGL", starUid: "STAR" };

export default function RoomPage({ params }) {
  const roomId = use(params).id;
  const router = useRouter();
  const { user, loading } = useAuth();
  const { organization, ready } = useTournament();
  const [room, setRoom] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    if (loading || !user) return;
    return onSnapshot(doc(db, "rooms", roomId), snapshot => {
      if (!snapshot.exists()) { setError("La sala no existe o fue eliminada."); setRoom(null); return; }
      const data = snapshot.data();
      setRoom(data);
      if (data.status === "playing" && data.tournament?.participantUids?.includes(user.uid)) router.push(`/room/${roomId}/simulation`);
    }, err => setError(err.message || "No se pudo conectar a la sala."));
  }, [roomId, user, loading, router]);

  async function run(action, operation) {
    setBusy(action);
    setError("");
    try { await operation(); }
    catch (err) { setError(err.message || "No se pudo completar la acción."); }
    finally { setBusy(""); }
  }

  if (loading || !ready) return <main className="min-h-screen flex items-center justify-center text-white">Cargando sala...</main>;
  if (!user) return <main className="min-h-screen p-8 text-white" role="alert">No se pudo iniciar sesión. Recargá la página para volver a intentar. <Link href="/multiplayer" className="text-amber-400 underline">Volver</Link></main>;
  if (!room) return <main className="min-h-screen p-8 text-white">{error || "Cargando sala..."} <Link href="/multiplayer" className="text-amber-400 underline">Volver</Link></main>;

  const players = room.players || [];
  const me = players.find(p => p.uid === user.uid);
  const isHost = room.hostId === user.uid;
  const included = players.filter(p => p.participating);
  const canStart = included.length > 0 && included.every(p => p.isReady);
  const inLobby = room.status === "lobby";
  const canReady = validOrganization(organization);

  return <main className="min-h-screen p-8 text-white flex flex-col items-center">
    <div className="w-full max-w-3xl bg-neutral-900/80 p-8 rounded-2xl border border-neutral-700">
      <div className="flex flex-wrap justify-between gap-4 border-b border-neutral-800 pb-6">
        <div><h1 className="text-3xl font-black text-amber-500">LOBBY</h1><p className="text-neutral-400 mt-2">{inLobby ? "Prepará tu equipo para el próximo Major." : "Major en curso."}</p></div>
        <div><span className="block text-sm text-neutral-400">CÓDIGO DE SALA</span><strong className="text-3xl font-mono tracking-widest">{roomId}</strong></div>
      </div>
      {error && <p role="alert" className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-2 rounded mt-4">{error}</p>}
      {!me && <p role="alert" className="mt-4 text-red-300">Ya no sos miembro de esta sala. <Link href="/multiplayer" className="underline">Volver a multijugador</Link></p>}
      <h2 className="text-xl font-bold mt-6">Organizaciones <span className="text-neutral-500 text-sm">{players.length} / 8</span></h2>
      <ul className="grid sm:grid-cols-2 gap-4 mt-4">{players.map(p => {
        const org = p.organization;
        const state = !p.participating ? "No participa" : room.status === "playing" && room.tournament?.participantUids?.includes(p.uid) ? "En partida" : p.isReady ? "Listo" : "Preparando equipo";
        return <li key={p.uid} className="rounded-xl border border-neutral-700 bg-neutral-800 p-4">
          <div className="flex items-center gap-3">{org?.icon && <img src={org.icon} alt="" width="48" height="48" className="object-contain" />}<div><strong>{org?.name || p.teamName}</strong><p className="text-sm text-neutral-400">{p.name}{p.uid === user.uid ? " (vos)" : ""}{p.uid === room.hostId ? " · Host" : ""}</p></div></div>
          <p className="mt-3 text-amber-400 font-bold">{state}</p>
          <p className="text-sm text-neutral-400 mt-1">Plantel: {org?.squad?.length || 0} jugadores</p>
          {org?.squad && <ul className="text-sm text-neutral-300 mt-2">{org.squad.map((entry, i) => <li key={i}>{entry.player?.name} {Object.entries(roles).filter(([field]) => org[field] === String(i)).map(([, label]) => label).join(" · ")}</li>)}</ul>}
          {isHost && inLobby && <button disabled={!!busy} onClick={() => run(`participation-${p.uid}`, () => setRoomParticipation(roomId, user.uid, p.uid, !p.participating))} className="mt-3 text-sm text-amber-400 underline disabled:opacity-50">{p.participating ? "Dejar fuera del próximo Major" : "Incluir en el próximo Major"}</button>}
        </li>;
      })}</ul>
      {me && inLobby && <div className="mt-6 space-y-3">
        <p className="text-sm text-neutral-400">Tu organización es local. Al confirmar que estás listo compartís su estado actual con la sala.</p>
        {!canReady && <p className="text-red-300">Tu organización necesita un plantel y roles válidos para confirmar.</p>}
        <div className="flex flex-wrap gap-3"><button disabled={!!busy} onClick={() => run("prepare", async () => {
          if (me.isReady) await setRoomReady(roomId, user.uid, organization, false);
          router.push(`/organization?room=${encodeURIComponent(roomId)}`);
        })} className="rounded-xl bg-neutral-700 px-4 py-3 font-bold">Preparar equipo</button>
          <button disabled={!!busy || !me.participating || (!me.isReady && !canReady)} onClick={() => run("ready", () => setRoomReady(roomId, user.uid, organization, !me.isReady))} className="rounded-xl bg-amber-600 px-4 py-3 font-bold disabled:opacity-50">{busy === "ready" ? "GUARDANDO..." : me.isReady ? "DEJAR DE ESTAR LISTO" : "ESTOY LISTO"}</button></div>
      </div>}
      {isHost && inLobby && <button disabled={!!busy || !canStart} onClick={() => run("start", () => startRoomMajor(roomId, user.uid))} className="w-full mt-6 rounded-xl bg-green-700 px-4 py-4 font-bold disabled:opacity-50">{busy === "start" ? "INICIANDO..." : "INICIAR MAJOR"}</button>}
      {isHost && inLobby && !canStart && <p className="text-sm text-neutral-400 mt-2">Todos los participantes incluidos deben estar listos.</p>}
      {room.status === "playing" && <Link href={`/room/${roomId}/simulation`} className="inline-block mt-6 text-amber-400 underline">Ver Major en curso</Link>}
      {inLobby && room.lastMajor && room.tournament && <Link href={`/room/${roomId}/simulation?results=1`} className="inline-block mt-6 text-amber-400 underline">Ver resultados del último Major</Link>}
      {me && inLobby && <button disabled={!!busy} onClick={() => run("leave", async () => { await leaveRoom(roomId, user.uid); router.push("/multiplayer"); })} className="block mt-6 text-neutral-400 underline disabled:opacity-50">{busy === "leave" ? "Saliendo..." : "Salir de la sala"}</button>}
    </div>
  </main>;
}
