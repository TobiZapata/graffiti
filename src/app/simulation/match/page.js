"use client";
import { Suspense, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTournament } from "@/context/TournamentContext";
import HybridMatchPlayer from "@/components/HybridMatchPlayer";
function MatchContent() {
  const searchParams = useSearchParams();
  const { matches, completeMatch, tournamentId, matchProgress, saveMatchProgress } = useTournament();
  const matchId = searchParams.get("id");
  const match = matches.find(candidate => candidate.id === matchId);
  const persistProgress = useCallback(progress => saveMatchProgress(matchId, progress), [matchId, saveMatchProgress]);
  if (!match) return <main className="p-6"><p>There is no match waiting to be played.</p>
    <Link href="/simulation" className="link mt-2 inline-block underline">Back to the Major</Link></main>;
  return <HybridMatchPlayer key={`${tournamentId}:${match.id}`} match={match} tournamentId={tournamentId}
    initialProgress={matchProgress?.[match.id]} onSaveProgress={persistProgress} onFinish={result => {
    return completeMatch(match.id, result);
  }} />;
}
export default function MatchPage() {
  return <Suspense fallback={<p className="p-6 text-ink-2">Loading match…</p>}><MatchContent /></Suspense>;
}
