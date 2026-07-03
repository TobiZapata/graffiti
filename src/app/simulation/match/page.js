"use client";

import { useEffect, useState, use, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTournament } from "@/context/TournamentContext";
import { simulateMatch } from "@/app/engines/MatchEngine";
import CSMatchViewer from "@/components/CSMatchViewer";

function MatchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const matchId = searchParams.get("id");
  const { matches, completeMatch } = useTournament();
  
  const [matchData, setMatchData] = useState(null);
  const [simulationDone, setSimulationDone] = useState(false);

  useEffect(() => {
    if (!matches.length || !matchId) return;

    const currentMatch = matches.find(m => m.id === matchId);
    if (!currentMatch || currentMatch.completed) {
      router.push("/simulation");
      return;
    }

    // Run simulation
    const { rounds, scoreTeam1, scoreTeam2 } = simulateMatch(currentMatch.teamA, currentMatch.teamB);
    setMatchData({ match: currentMatch, rounds, scoreTeam1, scoreTeam2 });
  }, [matches, matchId, router]);

  if (!matchData) {
    return <div className="p-8 text-white text-center">Loading match...</div>;
  }

  const handleFinishMatch = () => {
    // Record the result
    const { match, scoreTeam1, scoreTeam2 } = matchData;
    const winner = scoreTeam1 > scoreTeam2 ? match.teamA.id : match.teamB.id;
    completeMatch(match.id, {
      teamA: match.teamA,
      teamB: match.teamB,
      scoreA: scoreTeam1,
      scoreB: scoreTeam2,
      winner
    });
    router.push("/simulation");
  };

  return (
    <div className="relative min-h-screen bg-neutral-950">
      <div className="absolute top-4 right-4 z-50">
        <button
          onClick={handleFinishMatch}
          className="rounded bg-amber-600 px-6 py-2 font-bold text-white hover:bg-amber-500"
        >
          {simulationDone ? "RETURN TO TOURNAMENT" : "SKIP MATCH"}
        </button>
      </div>
      
      <CSMatchViewer 
        rounds={matchData.rounds} 
        onSimulationComplete={() => setSimulationDone(true)}
      />
    </div>
  );
}

export default function MatchPage() {
  return (
    <Suspense fallback={<div className="p-8 text-white text-center">Loading...</div>}>
      <MatchContent />
    </Suspense>
  );
}
