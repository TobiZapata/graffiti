"use client";

import { useTournament } from "@/context/TournamentContext";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function SimulationPage() {
  const { stage, swissRound, standings, matches, advanceRound } = useTournament();
  const router = useRouter();

  if (!standings || standings.length === 0) {
    return <div className="text-white p-8 text-center text-xl">Loading tournament...</div>;
  }

  const currentRoundMatches = matches.filter(m => m.round === swissRound);
  const allCompleted = currentRoundMatches.every(m => m.completed);
  const playerMatch = currentRoundMatches.find(m => m.isPlayerMatch);
  
  const handlePlayMatch = () => {
    if (playerMatch && !playerMatch.completed) {
      router.push(`/simulation/match?id=${playerMatch.id}`);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 p-8 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex items-center justify-between">
          <h1 className="text-4xl font-bold text-amber-500">
            {stage === "swiss" ? `SWISS STAGE - ROUND ${swissRound}` : stage.toUpperCase()}
          </h1>
          
          {stage === "swiss" && (
            <div className="flex gap-4">
              {playerMatch && !playerMatch.completed ? (
                <button
                  onClick={handlePlayMatch}
                  className="rounded bg-amber-600 px-6 py-3 font-bold hover:bg-amber-500 transition-colors"
                >
                  PLAY MATCH
                </button>
              ) : (
                <button
                  onClick={advanceRound}
                  className="rounded bg-blue-600 px-6 py-3 font-bold hover:bg-blue-500 transition-colors"
                >
                  {allCompleted ? "ADVANCE ROUND" : "SIMULATE & ADVANCE"}
                </button>
              )}
            </div>
          )}
        </header>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* MATCHUPS */}
          <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-6">
            <h2 className="mb-4 text-2xl font-bold">Round {swissRound} Matchups</h2>
            <div className="space-y-4">
              {currentRoundMatches.map((m) => (
                <div 
                  key={m.id} 
                  className={`flex items-center justify-between rounded-lg border p-4 ${m.isPlayerMatch ? 'border-amber-500 bg-amber-500/10' : 'border-neutral-700 bg-neutral-800'}`}
                >
                  <div className="flex w-1/3 items-center gap-3">
                    {m.teamA.icon && <Image src={m.teamA.icon} alt={m.teamA.name} width={32} height={32} />}
                    <span className="font-bold">{m.teamA.name}</span>
                  </div>
                  
                  <div className="flex w-1/3 justify-center text-xl font-bold text-neutral-400">
                    {m.completed ? `${m.result.scoreA} - ${m.result.scoreB}` : 'VS'}
                  </div>
                  
                  <div className="flex w-1/3 items-center justify-end gap-3">
                    <span className="font-bold">{m.teamB.name}</span>
                    {m.teamB.icon && <Image src={m.teamB.icon} alt={m.teamB.name} width={32} height={32} />}
                  </div>
                </div>
              ))}
            </div>
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
            <div className="text-center">
              <h2 className="mb-4 text-6xl font-bold text-red-600">ELIMINATED</h2>
              <p className="mb-8 text-2xl text-neutral-300">Your team was knocked out of the Major.</p>
              <button onClick={() => router.push("/")} className="rounded bg-neutral-800 px-8 py-4 font-bold hover:bg-neutral-700">
                BACK TO HOME
              </button>
            </div>
          </div>
        )}

        {stage === "playoffs" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="text-center">
              <h2 className="mb-4 text-6xl font-bold text-amber-500">QUALIFIED FOR PLAYOFFS</h2>
              <p className="mb-8 text-2xl text-neutral-300">You reached 3 wins! Playoffs coming soon.</p>
              <button onClick={() => router.push("/")} className="rounded bg-amber-600 px-8 py-4 font-bold text-white hover:bg-amber-500">
                BACK TO HOME
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
