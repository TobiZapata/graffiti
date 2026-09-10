"use client";

import { useEffect, useState, use, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MultiplayerProvider, useMultiplayerTournament } from "@/context/MultiplayerContext";
import { simulateMatch } from "@/app/engines/MatchEngine";
import CSMatchViewer from "@/components/CSMatchViewer";

const MAPS = [
  { folder: "ancient", icon: "map_icon_de_ancient.svg", bg: "de_ancient_png.png" },
  { folder: "anubis", icon: "map_icon_de_anubis.svg", bg: "de_anubis_png.png" },
  { folder: "cache", icon: "map_icon_de_cache.svg", bg: "de_cache_png.png" },
  { folder: "dust", icon: "map_icon_de_dust2.svg", bg: "de_dust2_png.png" },
  { folder: "inferno", icon: "map_icon_de_inferno.svg", bg: "de_inferno_png.png" },
  { folder: "mirage", icon: "map_icon_de_mirage.svg", bg: "de_mirage_png.png" },
  { folder: "nuke", icon: "map_icon_de_nuke.svg", bg: "de_nuke_png.png" }
];

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
    
    let hash = 0;
    for (let i = 0; i < currentMatch.id.length; i++) hash = currentMatch.id.charCodeAt(i) + ((hash << 5) - hash);
    let curHash = Math.abs(hash);
    let avail = MAPS.map((m, i) => i);
    let scheduledMaps = [];
    for(let i = 0; i < bestOf; i++) {
       let idx = curHash % avail.length;
       scheduledMaps.push(MAPS[avail[idx]]);
       avail.splice(idx, 1);
       curHash = (curHash * 31 + 17) % 1000000007;
    }

    setSeriesState({
      match: currentMatch,
      bestOf,
      winsA: 0,
      winsB: 0,
      mapsToWin: Math.ceil(bestOf / 2),
      scheduledMaps,
      mapHistory: [],
      currentMap: scheduledMaps[0]
    });
  }, [matches, matchId, router, seriesState, roomId]);

  useEffect(() => {
    if (seriesState && !matchData) {
      const seed = seriesState.match.id + "-map" + seriesState.mapHistory.length;
      const { rounds, scoreTeam1, scoreTeam2, playerStats } = simulateMatch(seriesState.match.teamA, seriesState.match.teamB, seed);
      setMatchData({ rounds, scoreTeam1, scoreTeam2, playerStats });
      setViewerKey(prev => prev + 1);
    }
  }, [seriesState, matchData]);

  if (!seriesState || !matchData) {
    return <div className="p-8 text-white text-center">Loading match...</div>;
  }

  const handleFinishMatch = () => {
    const { match, winsA, winsB, mapsToWin, bestOf, scheduledMaps, mapHistory } = seriesState;
    const { scoreTeam1, scoreTeam2 } = matchData;
    
    const newWinsA = winsA + (scoreTeam1 > scoreTeam2 ? 1 : 0);
    const newWinsB = winsB + (scoreTeam1 < scoreTeam2 ? 1 : 0);
    const mapResult = {
       map: scheduledMaps[mapHistory.length],
       scoreA: scoreTeam1,
       scoreB: scoreTeam2,
       winnerId: scoreTeam1 > scoreTeam2 ? match.teamA.id : match.teamB.id,
    };
    
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
      setSeriesState({
        ...seriesState,
        winsA: newWinsA,
        winsB: newWinsB,
        mapHistory: [...mapHistory, mapResult],
        currentMap: scheduledMaps[mapHistory.length + 1]
      });
      setMatchData(null);
      setSimulationDone(false);
    }
  };

  const { match, bestOf, winsA, winsB, currentMap } = seriesState;
  const isSeries = bestOf > 1;

  return (
    <div 
      className="relative min-h-screen pt-20"
      style={{ 
        backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.8)), url('/maps/${currentMap.folder}/${currentMap.bg}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      {isSeries && (
        <div className="absolute top-4 left-4 z-50 flex items-center bg-neutral-950/80 border border-neutral-800 rounded-lg px-3 py-2 backdrop-blur-md shadow-xl">
          {seriesState.scheduledMaps.map((mapInfo, index) => {
            const historyNode = seriesState.mapHistory[index];
            const isCurrent = index === seriesState.mapHistory.length;
            const isFuture = index > seriesState.mapHistory.length;
            
            return (
              <div key={index} className="flex items-center">
                {index > 0 && <span className="text-neutral-600 mx-2 text-[10px]">▶</span>}
                <div className={`flex items-center gap-2 ${isFuture ? 'opacity-40' : ''}`}>
                  {historyNode && historyNode.winnerId === match.teamA.id && match.teamA.icon && (
                    <img src={match.teamA.icon} alt="Winner" className="w-5 h-5 object-contain drop-shadow-md" />
                  )}
                  {historyNode && historyNode.winnerId === match.teamB.id && match.teamB.icon && (
                    <img src={match.teamB.icon} alt="Winner" className="w-5 h-5 object-contain drop-shadow-md" />
                  )}
                  <span className={`font-bold text-sm tracking-wide ${isCurrent ? 'text-white drop-shadow-[0_0_4px_rgba(255,255,255,0.4)]' : 'text-neutral-400'}`}>
                    {mapInfo.folder.toUpperCase()}
                  </span>
                  {historyNode && (
                    <span className="text-xs font-mono font-bold text-neutral-300 ml-1">
                      {historyNode.scoreA}:{historyNode.scoreB}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center z-50">
        <img 
          src={`/maps/${currentMap.folder}/${currentMap.icon}`} 
          alt={currentMap.folder} 
          className="w-16 h-16 opacity-80 mb-2 drop-shadow-[0_0_8px_rgba(0,0,0,0.8)]"
        />
        
      </div>
      
      <div className="absolute top-4 right-4 z-50">
        <button
          onClick={handleFinishMatch}
          className="rounded bg-amber-600 px-6 py-2 font-bold text-white hover:bg-amber-500 shadow-md backdrop-blur-sm"
        >
          {simulationDone ? (isSeries && (winsA + (matchData.scoreTeam1 > matchData.scoreTeam2 ? 1 : 0) < seriesState.mapsToWin && winsB + (matchData.scoreTeam1 < matchData.scoreTeam2 ? 1 : 0) < seriesState.mapsToWin) ? "NEXT MAP" : "VIEW RESULTS") : "SKIP MAP"}
        </button>
      </div>
      
      <CSMatchViewer 
        key={viewerKey}
        rounds={matchData.rounds} 
        matchSummary={matchData.playerStats}
        onSimulationComplete={() => setSimulationDone(true)}
        teamA={match.teamA}
        teamB={match.teamB}
        seriesState={seriesState}
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
