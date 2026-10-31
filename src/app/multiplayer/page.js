"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useTournament } from "@/context/TournamentContext";
import { createRoom, joinRoom, listPublicRooms } from "@/lib/roomService";
import { validOrganization } from "@/lib/localCareer.mjs";

export default function MultiplayerPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { organization, ready, storageError } = useTournament();
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [rooms, setRooms] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [refreshing, setRefreshing] = useState(true);

  useEffect(() => {
    if (loading || !user) return;
    let active = true;
    listPublicRooms().then(result => { if (active) setRooms(result); })
      .catch(err => { if (active) setError(err.message || "No se pudieron cargar las salas públicas."); })
      .finally(() => { if (active) setRefreshing(false); });
    return () => { active = false; };
  }, [loading, user]);

  async function enter(code) {
    if (!user) return setError("No se pudo iniciar sesión. Recargá la página para volver a intentar.");
    if (!validOrganization(organization)) return setError("Necesitás una organización válida para entrar a una sala.");
    if (code !== null && !/^[A-Z0-9]{4}$/.test(code.trim().toUpperCase())) return setError("Ingresá un código de sala válido de 4 caracteres.");
    setError("");
    setBusy(code === null ? "create" : code);
    try {
      const displayName = name.trim() || user.displayName || organization.name;
      const joinedCode = code === null
        ? await createRoom(user.uid, displayName, organization, isPublic ? "public" : "private")
        : await joinRoom(code.trim().toUpperCase(), user.uid, displayName, organization);
      router.push(`/room/${joinedCode}`);
    } catch (err) {
      setError(err.message || "No se pudo entrar a la sala.");
      setBusy("");
    }
  }

  if (loading || !ready) return <main className="min-h-screen flex items-center justify-center text-white">Conectando...</main>;
  if (!user) return <main className="min-h-screen p-8 text-white" role="alert">No se pudo iniciar sesión. Recargá la página para volver a intentar. <Link href="/" className="text-amber-400 underline">Volver al inicio</Link></main>;
  if (!organization) return <main className="min-h-screen p-8 text-white"><p>{storageError || "Necesitás una organización para jugar multijugador."}</p><Link href="/organization" className="text-amber-400 underline">Ir a mi organización</Link> · <Link href="/play" className="text-amber-400 underline">Crear organización</Link></main>;

  return <main className="min-h-screen p-8 text-white flex flex-col items-center">
    <div className="w-full max-w-2xl bg-neutral-900/80 p-8 rounded-2xl border border-neutral-700">
      <Link href="/" className="text-neutral-400 hover:text-white">← Volver</Link>
      <h1 className="text-3xl font-black mt-4 text-amber-500">MULTIJUGADOR</h1>
      <p className="text-neutral-400 mt-2">Jugás con {organization.name}. Tu organización se guarda en este dispositivo; al confirmar que estás listo compartís una copia con la sala.</p>
      {error && <p role="alert" className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-2 rounded my-4">{error}</p>}
      <label className="block mt-6 text-sm font-bold text-neutral-400" htmlFor="nickname">APODO OPCIONAL</label>
      <input id="nickname" value={name} onChange={e => setName(e.target.value)} placeholder={user.displayName || organization.name} maxLength={15} className="w-full rounded-xl border border-neutral-700 bg-neutral-800 px-4 py-3 mt-2" />
      <div className="grid sm:grid-cols-2 gap-4 mt-6">
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-2"><input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} /> Sala pública</label>
          <button onClick={() => enter(null)} disabled={!!busy} className="rounded-xl bg-amber-600 px-4 py-3 font-bold disabled:opacity-50">{busy === "create" ? "CREANDO..." : "CREAR SALA"}</button>
        </div>
        <div className="flex flex-col gap-3">
          <input aria-label="Código de sala" value={roomCode} onChange={e => setRoomCode(e.target.value.toUpperCase())} placeholder="CÓDIGO" maxLength={4} className="rounded-xl border border-neutral-700 bg-neutral-800 px-4 py-3" />
          <button onClick={() => enter(roomCode)} disabled={!!busy} className="rounded-xl bg-neutral-700 px-4 py-3 font-bold disabled:opacity-50">ENTRAR CON CÓDIGO</button>
        </div>
      </div>
      <h2 className="text-xl font-bold mt-8">Salas públicas</h2>
      <button disabled={refreshing} onClick={async () => {
        setRefreshing(true); setError("");
        try { setRooms(await listPublicRooms()); }
        catch (err) { setError(err.message); }
        finally { setRefreshing(false); }
      }} className="mt-2 text-sm text-amber-400 underline disabled:opacity-50">Actualizar salas</button>
      {refreshing ? <p className="text-neutral-400 mt-3">Cargando salas...</p> : rooms.length === 0 ? <p className="text-neutral-400 mt-3">No hay salas públicas disponibles.</p> : <ul className="mt-3 space-y-2">{rooms.map(room => <li key={room.id} className="flex items-center justify-between gap-4 rounded-xl bg-neutral-800 p-4"><span><strong>{room.id}</strong> · {room.players?.length || 0} jugadores</span><button onClick={() => enter(room.id)} disabled={!!busy} className="text-amber-400 font-bold disabled:opacity-50">Entrar</button></li>)}</ul>}
      <Link href="/organization" className="inline-block mt-6 text-amber-400 underline">Preparar mi organización</Link>
    </div>
  </main>;
}
