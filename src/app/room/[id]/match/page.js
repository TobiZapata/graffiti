"use client";

import { useEffect, useState, use, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MultiplayerProvider, useMultiplayerTournament } from "@/context/MultiplayerContext";
import { simulateMatch } from "@/app/engines/MatchEngine";
import CSMatchViewer from "@/components/CSMatchViewer";

function MatchContent({ roomId }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const matchId = searchParams.get("id");
  const { matches, completeMatch } = useMultiplayerTournament();
  
  const [matchData, setMatchData] = useState(null);
  const [simulationDone, setSimulationDone] = useState(false);
  const [seriesState, setSeriesState] = useState(null);
  const [viewerKey, setViewerKey] = useState(0);

  useEffect(() => {
    if (!matches || !matches.length || !matchId || seriesState) return;

    const currentMatch = matches.find(m => m.id === matchId);
    if (!currentMatch || currentMatch.completed) {
      router.push(`/room/${roomId}/simulation`);
      return;
    }

    const isFinal = currentMatch.round === 'Final';
    const isPlayoff = ['Quarterfinals', 'Semifinals'].includes(currentMatch.round);
    const bestOf = isFinal ? 5 : (isPlayoff ? 3 : 1);
    
    setSeriesState({
      match: currentMatch,
      bestOf,
      winsA: 0,
      winsB: 0,
      mapsToWin: Math.ceil(bestOf / 2)
    });
  }, [matches, matchId, router, seriesState, roomId]);

  useEffect(() => {
    if (seriesState && !matchData) {
      const matchSeed = `${matchId}_map${seriesState.winsA + seriesState.winsB + 1}`;
      const { rounds, scoreTeam1, scoreTeam2, playerStats } = simulateMatch(seriesState.match.teamA, seriesState.match.teamB, matchSeed);
      setMatchData({ rounds, scoreTeam1, scoreTeam2, playerStats });
      setViewerKey(prev => prev + 1);
    }
  }, [seriesState, matchData]);

  if (!seriesState || !matchData) {
    return <div className="p-8 text-white text-center">Loading match...</div>;
  }

  const handleFinishMatch = () => {
    const { match, winsA, winsB, mapsToWin, bestOf } = seriesState;
    const { scoreTeam1, scoreTeam2 } = matchData;
    
    const newWinsA = winsA + (scoreTeam1 > scoreTeam2 ? 1 : 0);
    const newWinsB = winsB + (scoreTeam1 < scoreTeam2 ? 1 : 0);
    
    if (newWinsA === mapsToWin || newWinsB === mapsToWin) {
      const winner = newWinsA > newWinsB ? match.teamA.id : match.teamB.id;
      const finalScoreA = bestOf === 1 ? scoreTeam1 : newWinsA;
      const finalScoreB = bestOf === 1 ? scoreTeam2 : newWinsB;

      completeMatch(match.id, {
        teamA: match.teamA,
        teamB: match.teamB,
        scoreA: finalScoreA,
        scoreB: finalScoreB,
        winner
      });
      router.push(`/room/${roomId}/simulation`);
    } else {
      setSeriesState({ ...seriesState, winsA: newWinsA, winsB: newWinsB });
      setMatchData(null);
      setSimulationDone(false);
    }
  };

  const { match, bestOf, winsA, winsB } = seriesState;
  const isSeries = bestOf > 1;

  return (
    <div className="relative min-h-screen pt-20">
      {isSeries && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-neutral-900/80 px-6 py-2 rounded-xl text-center border border-neutral-700 shadow-lg">
          <div className="text-sm text-neutral-400 font-bold mb-1">BEST OF {bestOf} (MAP {winsA + winsB + 1})</div>
          <div className="text-xl font-bold flex gap-4 items-center">
            <span className="text-blue-400">{match.teamA.name} {winsA}</span>
            <span className="text-neutral-500">-</span>
            <span className="text-amber-400">{winsB} {match.teamB.name}</span>
          </div>
        </div>
      )}
      
      <div className="absolute top-4 right-4 z-50">
        <button
          onClick={handleFinishMatch}
          className="rounded bg-amber-600 px-6 py-2 font-bold text-white hover:bg-amber-500 shadow-md"
        >
          {simulationDone ? (isSeries && (winsA + (matchData.scoreTeam1 > matchData.scoreTeam2 ? 1 : 0) < seriesState.mapsToWin && winsB + (matchData.scoreTeam1 < matchData.scoreTeam2 ? 1 : 0) < seriesState.mapsToWin) ? "NEXT MAP" : "VIEW RESULTS") : "SKIP MAP"}
        </button>
      </div>
      
      <CSMatchViewer 
        key={viewerKey}
        rounds={matchData.rounds} 
        matchSummary={matchData.playerStats}
        onSimulationComplete={() => setSimulationDone(true)}
      />
    </div>
  );
}

export default function MatchPage({ params }) {
  const roomId = use(params).id;
  return (
    <MultiplayerProvider roomId={roomId}>
      <Suspense fallback={<div className="p-8 text-white text-center">Loading...</div>}>
        <MatchContent roomId={roomId} />
      </Suspense>
    </MultiplayerProvider>
  );
}
