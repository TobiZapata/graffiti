"use client";

import { useEffect } from "react";
import { useTournament } from "@/context/TournamentContext";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function SimulationPage() {
  const { stage, swissRound, standings, matches, advanceRound, mySquad } = useTournament();
  const router = useRouter();

  if (!standings || standings.length === 0) {
    return <div className="text-white p-8 text-center text-xl">Loading tournament...</div>;
  }

  const playoffRounds = ['Quarterfinals', 'Semifinals', 'Final'];
  const currentRoundMatches = matches.filter(m => 
    stage === "swiss" ? m.round === swissRound : playoffRounds.includes(m.round)
  );
  const allCompleted = currentRoundMatches.every(m => m.completed);
  const playerMatch = currentRoundMatches.find(m => m.isPlayerMatch && !m.completed);
  
  const poolMatches = {};
  if (stage === "swiss") {
    currentRoundMatches.forEach(m => {
      const poolKey = `${m.teamA.wins}-${m.teamA.losses}`;
      if (!poolMatches[poolKey]) poolMatches[poolKey] = [];
      poolMatches[poolKey].push(m);
    });
  }
  
  const handlePlayMatch = () => {
    if (playerMatch && !playerMatch.completed) {
      router.push(`/simulation/match?id=${playerMatch.id}`);
    }
  };

  useEffect(() => {
    if (["swiss", "playoffs"].includes(stage) && !playerMatch) {
      advanceRound();
    }
  }, [stage, playerMatch, advanceRound]);

  return (
    <div className="min-h-screen bg-neutral-950 p-8 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex items-center justify-between">
          <h1 className="text-4xl font-bold text-amber-500">
            {stage === "swiss" ? `SWISS STAGE - ROUND ${swissRound}` : stage === "won" ? "MAJOR CHAMPIONS" : stage.toUpperCase()}
          </h1>
          
          {["swiss", "playoffs"].includes(stage) && playerMatch && !playerMatch.completed && (
            <div className="flex gap-4">
              <button
                onClick={handlePlayMatch}
                className="rounded bg-amber-600 px-6 py-3 font-bold hover:bg-amber-500 transition-colors"
              >
                PLAY MATCH
              </button>
            </div>
          )}
        </header>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* MATCHUPS */}
          <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-6 lg:col-span-2">
            <h2 className="mb-4 text-2xl font-bold">{stage === "swiss" ? `Round ${swissRound} Bracket` : 'Playoffs Bracket'}</h2>
            
            {stage === "swiss" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Object.keys(poolMatches).sort((a,b) => {
                   const [wa, la] = a.split('-').map(Number);
                   const [wb, lb] = b.split('-').map(Number);
                   return (wb - lb) - (wa - la);
                }).map(poolKey => (
                  <div key={poolKey} className="space-y-4">
                     <h3 className="text-xl font-bold text-neutral-400 text-center bg-neutral-800 p-2 rounded-lg">{poolKey} Matches</h3>
                     {poolMatches[poolKey].map(m => (
                       <MatchRow key={m.id} m={m} />
                     ))}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-8">
                {["Quarterfinals", "Semifinals", "Final"].map(roundName => {
                  const rMatches = matches.filter(m => m.round === roundName);
                  if (rMatches.length === 0) return null;
                  return (
                    <div key={roundName} className="space-y-4">
                      <h3 className="text-xl font-bold text-amber-500 text-center bg-neutral-800 p-2 rounded-lg">{roundName}</h3>
                      <div className={`grid grid-cols-1 md:grid-cols-${rMatches.length === 4 ? 2 : rMatches.length === 2 ? 2 : 1} gap-6`}>
                        {rMatches.map(m => <MatchRow key={m.id} m={m} />)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* STANDINGS */}
          <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-6">
            <h2 className="mb-4 text-2xl font-bold">Swiss Standings</h2>
            <div className="overflow-hidden rounded-lg border border-neutral-700">
              <table className="w-full text-left text-sm">
                <thead className="bg-neutral-800">
                  <tr>
                    <th className="p-3">Team</th>
                    <th className="p-3 text-center">W</th>
                    <th className="p-3 text-center">L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {[...standings]
                    .sort((a, b) => b.wins - a.wins || a.losses - b.losses)
                    .map(t => (
                      <tr key={t.id} className={t.isPlayer ? 'bg-amber-900/30 font-bold text-amber-500' : ''}>
                        <td className="p-3 flex items-center gap-2">
                          {t.icon && <Image src={t.icon} alt={t.name} width={24} height={24} />}
                          {t.name}
                        </td>
                        <td className="p-3 text-center text-green-500">{t.wins}</td>
                        <td className="p-3 text-center text-red-500">{t.losses}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {stage === "eliminated" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="text-center bg-neutral-900 border border-neutral-700 p-8 rounded-xl max-w-2xl w-full mx-4 shadow-2xl">
              <h2 className="mb-4 text-6xl font-bold text-red-600">ELIMINATED</h2>
              <p className="mb-8 text-2xl text-neutral-300">Your team was knocked out of the Major.</p>
              <TeamSummary standings={standings} mySquad={mySquad} />
              <button onClick={() => router.push("/")} className="rounded bg-neutral-800 px-8 py-4 font-bold hover:bg-neutral-700 w-full mt-4">
                BACK TO HOME
              </button>
            </div>
          </div>
        )}

        {stage === "won" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="text-center bg-neutral-900 border border-neutral-700 p-8 rounded-xl max-w-2xl w-full mx-4 shadow-2xl border-amber-500/50">
              <h2 className="mb-4 text-6xl font-bold text-amber-500">MAJOR CHAMPIONS!</h2>
              <p className="mb-8 text-2xl text-neutral-300">You won the Grand Final!</p>
              <TeamSummary standings={standings} mySquad={mySquad} />
              <button onClick={() => router.push("/")} className="rounded bg-amber-600 px-8 py-4 font-bold text-white hover:bg-amber-500 w-full mt-4">
                BACK TO HOME
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MatchRow({ m }) {
  return (
    <div className={`flex items-center justify-between rounded-lg border p-4 ${m.isPlayerMatch ? 'border-amber-500 bg-amber-500/10' : 'border-neutral-700 bg-neutral-800'}`}>
      <div className="flex w-[40%] items-center gap-3">
        {m.teamA.icon && <Image src={m.teamA.icon} alt={m.teamA.name} width={32} height={32} />}
        <span className={`font-bold ${m.completed && m.result.winner === m.teamA.id ? 'text-green-500' : m.completed && m.result.winner !== m.teamA.id ? 'text-neutral-500' : ''}`}>{m.teamA.name}</span>
      </div>
      
      <div className="flex w-[20%] justify-center text-lg font-bold text-neutral-400">
        {m.completed ? `${m.result.scoreA} - ${m.result.scoreB}` : 'VS'}
      </div>
      
      <div className="flex w-[40%] items-center justify-end gap-3">
        <span className={`font-bold text-right ${m.completed && m.result.winner === m.teamB.id ? 'text-green-500' : m.completed && m.result.winner !== m.teamB.id ? 'text-neutral-500' : ''}`}>{m.teamB.name}</span>
        {m.teamB.icon && <Image src={m.teamB.icon} alt={m.teamB.name} width={32} height={32} />}
      </div>
    </div>
  );
}

function TeamSummary({ standings, mySquad }) {
  const playerRecord = standings.find(t => t.isPlayer);
  const { stage, matches } = useTournament();
  
  let placement = "Swiss Stage";
  if (stage === "eliminated") {
    if (playerRecord?.wins === 3) {
      const qfLost = matches.find(m => m.round === "Quarterfinals" && m.isPlayerMatch && m.completed && m.result.winner !== "player_team");
      const sfLost = matches.find(m => m.round === "Semifinals" && m.isPlayerMatch && m.completed && m.result.winner !== "player_team");
      const fLost = matches.find(m => m.round === "Final" && m.isPlayerMatch && m.completed && m.result.winner !== "player_team");
      if (fLost) placement = "2nd Place";
      else if (sfLost) placement = "3rd-4th Place";
      else if (qfLost) placement = "5th-8th Place";
    } else {
      if (playerRecord?.wins === 0) placement = "15th-16th Place";
      else if (playerRecord?.wins === 1) placement = "12th-14th Place";
      else if (playerRecord?.wins === 2) placement = "9th-11th Place";
    }
  } else if (stage === "won") {
    placement = "1st Place (Champion)";
  }

  return (
    <div className="mb-4 p-4 bg-neutral-800 rounded-lg">
      <h3 className="text-xl font-bold mb-4 text-amber-500">My Team</h3>
      <div className="flex justify-center items-center gap-4 flex-wrap mb-4">
        {mySquad?.map(s => (
          <div key={s.player.id} className="text-center bg-neutral-900 p-2 rounded border border-neutral-700 min-w-[100px]">
            <span className="block font-bold text-sm">{s.player.name}</span>
            <span className="text-xs text-neutral-400">{s.assignedRole}</span>
          </div>
        ))}
      </div>
      <p className="text-lg font-bold text-neutral-300">Final Placement: <span className="text-amber-500">{placement}</span></p>
      <p className="text-sm text-neutral-500">Swiss Record: {playerRecord?.wins} - {playerRecord?.losses}</p>
    </div>
  );
}
