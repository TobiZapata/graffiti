"use client";

import { Suspense, use, useCallback, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MultiplayerProvider, useMultiplayerTournament } from "@/context/MultiplayerContext";
import { validSeriesProgress } from "@/lib/replaySeries.mjs";
import HybridMatchPlayer from "@/components/HybridMatchPlayer";

function RoomReplay({ match, roomId, tournamentId, userUid, completeMatch }) {
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
    catch { setError("Your playback position could not be saved in this tab."); }
  }, [key]);
  if (resume?.invalid && !match.completed) return <main className="p-6"><p role="alert">The saved progress for this match could not be read.</p>
    <button type="button" className="btn btn-secondary mt-4" onClick={() => { sessionStorage.removeItem(key); window.location.reload(); }}>Restart playback</button></main>;
  return <>{error && <p role="alert" className="p-4 text-negative">{error}</p>}
    <HybridMatchPlayer match={match} tournamentId={`${roomId}:${tournamentId}`} initialProgress={resume} onSaveProgress={save}
      backHref={`/room/${roomId}/simulation`} onFinish={async result => {
        const accepted = await completeMatch(match.id, result);
        try { sessionStorage.removeItem(key); } catch { /* A completed match no longer uses its saved playback. */ }
        return accepted;
      }} />
  </>;
}

function MatchContent({ roomId }) {
  const searchParams = useSearchParams();
  const { matches, completeMatch, tournamentId, userUid, matchesStarted } = useMultiplayerTournament();
  const match = matches.find(item => item.id === searchParams.get("id"));
  if (!match || !match.playerUids?.includes(userUid) || (!matchesStarted && !match.completed)) return <main className="p-6">
    <p>You have no match to play this round.</p>
    <Link href={`/room/${roomId}/simulation`} className="link mt-2 inline-block underline">Back to the Major</Link></main>;
  return <RoomReplay key={`${tournamentId}:${match.id}:${userUid}`} match={match} roomId={roomId}
    tournamentId={tournamentId} userUid={userUid} completeMatch={completeMatch} />;
}

export default function MatchPage({ params }) {
  const roomId = use(params).id;
  return <MultiplayerProvider roomId={roomId}><Suspense fallback={<p className="p-6 text-ink-2">Loading match…</p>}>
    <MatchContent roomId={roomId} />
  </Suspense></MultiplayerProvider>;
}
