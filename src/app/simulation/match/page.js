"use client";
import { Suspense, useCallback, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTournament } from "@/context/TournamentContext";
import HybridMatchPlayer from "@/components/HybridMatchPlayer";

const PLAYBACK_MODE_KEY = "major-mvp:sp-playback-mode";
const defaultPlaybackMode = () => "full";

function readPlaybackMode() {
  try { return localStorage.getItem(PLAYBACK_MODE_KEY) === "highlights" ? "highlights" : "full"; }
  catch { return defaultPlaybackMode(); }
}

function subscribePlaybackMode(onChange) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function MatchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { matches, completeMatch, tournamentId, simulation, matchProgress, saveMatchProgress, canAbandonMajor, abandonMajor } = useTournament();
  const matchId = searchParams.get("id");
  const match = matches.find(candidate => candidate.id === matchId);
  const storedMode = useSyncExternalStore(subscribePlaybackMode, readPlaybackMode, defaultPlaybackMode);
  const persistProgress = useCallback(progress => {
    // The career checkpoint accepts legacy speeds. The viewer restores 6x from its own preference.
    const checkpoint = progress.playback?.speed === 6
      ? { ...progress, playback: { ...progress.playback, speed: 1 } }
      : progress;
    return saveMatchProgress(matchId, checkpoint);
  }, [matchId, saveMatchProgress]);
  if (!match || !match.isPlayerMatch) return <main className="p-6"><p>There is no match waiting to be played.</p>
    <Link href="/simulation" className="link mt-2 inline-block underline">Back to the Major</Link></main>;
  return <HybridMatchPlayer key={`${tournamentId}:${match.id}`} match={match} tournamentId={tournamentId} simulation={simulation}
    playbackMode={storedMode} onAbandon={canAbandonMajor ? () => {
      if (!abandonMajor()) return false;
      router.replace("/organization");
      return true;
    } : undefined}
    vetoPlayer={match.teamA.isPlayer ? 'A' : 'B'}
    initialProgress={matchProgress?.[match.id]} onSaveProgress={persistProgress} onFinish={result => {
    return completeMatch(match.id, result);
  }} />;
}
export default function MatchPage() {
  return <Suspense fallback={<p className="p-6 text-ink-2">Loading match…</p>}><MatchContent /></Suspense>;
}
