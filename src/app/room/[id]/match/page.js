"use client";

import { Suspense, use, useCallback, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MultiplayerProvider, useMultiplayerTournament } from "@/context/MultiplayerContext";
import { validSeriesProgress } from "@/lib/replaySeries.mjs";
import HybridMatchPlayer from "@/components/HybridMatchPlayer";

function RoomReplay({ match, roomId, tournamentId, userUid, completeMatch }) {
  const router = useRouter();
  const key = `major-mvp:room-replay:${roomId}:${tournamentId}:${match.id}:${userUid}`;
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
    catch { setError("No se pudo guardar la posición de reproducción en esta pestaña."); }
  }, [key]);
  if (resume?.invalid) return <main className="p-8 text-white"><p role="alert">No se pudo leer el progreso de este partido.</p>
    <button onClick={() => { sessionStorage.removeItem(key); window.location.reload(); }}>Reiniciar reproducción</button></main>;
  return <>{error && <p role="alert" className="p-4 text-red-300">{error}</p>}
    <HybridMatchPlayer match={match} tournamentId={`${roomId}:${tournamentId}`} initialProgress={resume} onSaveProgress={save}
      backHref={`/room/${roomId}/simulation`} onFinish={async result => {
        await completeMatch(match.id, result);
        try { sessionStorage.removeItem(key); } catch { /* A completed match no longer uses its saved playback. */ }
        router.push(`/room/${roomId}/simulation`);
      }} />
  </>;
}

function MatchContent({ roomId }) {
  const searchParams = useSearchParams();
  const { matches, completeMatch, tournamentId, userUid, matchesStarted } = useMultiplayerTournament();
  const match = matches.find(item => item.id === searchParams.get("id"));
  if (!match || match.completed || !match.playerUids?.includes(userUid) || !matchesStarted) return <main className="p-8 text-white">
    <p>{match?.completed ? "Este partido ya terminó." : "No tenés un partido habilitado en esta ronda."}</p>
    <Link href={`/room/${roomId}/simulation`} className="text-amber-400 underline">Volver al Major</Link></main>;
  return <RoomReplay key={`${tournamentId}:${match.id}:${userUid}`} match={match} roomId={roomId}
    tournamentId={tournamentId} userUid={userUid} completeMatch={completeMatch} />;
}

export default function MatchPage({ params }) {
  const roomId = use(params).id;
  return <MultiplayerProvider roomId={roomId}><Suspense fallback={<p className="p-8 text-white">Cargando partido…</p>}>
    <MatchContent roomId={roomId} />
  </Suspense></MultiplayerProvider>;
}
