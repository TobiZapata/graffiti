"use client";
import { Suspense, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTournament } from "@/context/TournamentContext";
import HybridMatchPlayer from "@/components/HybridMatchPlayer";
function MatchContent() {
  const router = useRouter(), searchParams = useSearchParams();
  const { matches, completeMatch, tournamentId, matchProgress, saveMatchProgress } = useTournament();
  const matchId = searchParams.get("id");
  const match = matches.find(candidate => candidate.id === matchId);
  const persistProgress = useCallback(progress => saveMatchProgress(matchId, progress), [matchId, saveMatchProgress]);
  if (!match || match.completed) return <main className="p-8 text-white"><p>No hay una partida pendiente en esta sesion.</p>
    <Link href="/simulation">Volver al torneo</Link> / <Link href="/play">Armar un equipo</Link></main>;
  return <HybridMatchPlayer key={`${tournamentId}:${match.id}`} match={match} tournamentId={tournamentId}
    initialProgress={matchProgress?.[match.id]} onSaveProgress={persistProgress} onFinish={result => {
    completeMatch(match.id, result);
    router.push("/simulation");
  }} />;
}
export default function MatchPage() {
  return <Suspense fallback={<p className="p-8 text-white">Cargando partida...</p>}><MatchContent /></Suspense>;
}
