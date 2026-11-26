"use client";
import { Suspense, useCallback, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
  const searchParams = useSearchParams();
  const { matches, completeMatch, tournamentId, simulation, matchProgress, saveMatchProgress } = useTournament();
  const matchId = searchParams.get("id");
  const match = matches.find(candidate => candidate.id === matchId);
  const storedMode = useSyncExternalStore(subscribePlaybackMode, readPlaybackMode, defaultPlaybackMode);
  const [chosenMode, setChosenMode] = useState(null);
  const changePlaybackMode = (mode) => {
    setChosenMode(mode);
    try { localStorage.setItem(PLAYBACK_MODE_KEY, mode); }
    catch { /* The current selection still works when storage is unavailable. */ }
  };
  const persistProgress = useCallback(progress => saveMatchProgress(matchId, progress), [matchId, saveMatchProgress]);
  if (!match || !match.isPlayerMatch) return <main className="p-6"><p>There is no match waiting to be played.</p>
    <Link href="/simulation" className="link mt-2 inline-block underline">Back to the Major</Link></main>;
  return <HybridMatchPlayer key={`${tournamentId}:${match.id}`} match={match} tournamentId={tournamentId} simulation={simulation}
    playbackMode={chosenMode ?? storedMode} onPlaybackModeChange={changePlaybackMode}
    vetoPlayer={match.teamA.isPlayer ? 'A' : 'B'}
    initialProgress={matchProgress?.[match.id]} onSaveProgress={persistProgress} onFinish={result => {
    return completeMatch(match.id, result);
  }} />;
}
export default function MatchPage() {
  return <Suspense fallback={<p className="p-6 text-ink-2">Loading match…</p>}><MatchContent /></Suspense>;
}
