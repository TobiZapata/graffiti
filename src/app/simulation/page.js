"use client";

import { useEffect } from "react";
import { useTournament } from "@/context/TournamentContext";
import { useRouter } from "next/navigation";


// Definición de la estructura del Swiss (pools por ronda)
const SWISS_STRUCTURE = [
  { round: 1, pools: [{ record: "0-0", matchCount: 8, format: "BO1" }] },
  {
    round: 2,
    pools: [
      { record: "1-0", matchCount: 4, format: "BO1" },
      { record: "0-1", matchCount: 4, format: "BO1" },
    ],
  },
  {
    round: 3,
    pools: [
      { record: "2-0", matchCount: 2, format: "BO3", advancing: true },
      { record: "1-1", matchCount: 4, format: "BO1" },
      { record: "0-2", matchCount: 2, format: "BO3", eliminating: true },
    ],
  },
  {
    round: 4,
    pools: [
      { record: "2-1", matchCount: 3, format: "BO3", advancing: true },
      { record: "1-2", matchCount: 3, format: "BO3", eliminating: true },
    ],
  },
  {
    round: 5,
    pools: [
      {
        record: "2-2",
        matchCount: 3,
        format: "BO3",
        advancing: true,
        eliminating: true,
      },
    ],
  },
];

export default function SimulationPage() {
  const {
    stage,
    swissRound,
    standings,
    matches,
    advanceRound,
    mySquad,
    teamName,
    continueToPlayoffs,
    showFinalResult,
    pendingResult,
  } = useTournament();
  const router = useRouter();

  const playoffRounds = ["Quarterfinals", "Semifinals", "Final"];
  const currentRoundMatches = matches.filter((m) =>
    stage === "swiss"
      ? m.round === swissRound
      : playoffRounds.includes(m.round),
  );
  const playerMatch = currentRoundMatches.find(
    (m) => m.isPlayerMatch && !m.completed,
  );

  useEffect(() => {
    if (!standings || standings.length === 0) return;
    if (["swiss", "playoffs"].includes(stage) && !playerMatch) {
      advanceRound();
    }
  }, [stage, playerMatch, advanceRound, standings]);

  if (!standings || standings.length === 0) {
    return (
      <div className="text-white p-8 text-center text-xl">
        Loading tournament...
      </div>
    );
  }

  const handlePlayMatch = () => {
    if (playerMatch && !playerMatch.completed) {
      router.push(`/simulation/match?id=${playerMatch.id}`);
    }
  };

  // Agrupar TODOS los matches por su pool (W:L del teamA al momento del match)
  const getMatchesByPool = () => {
    const grouped = {};
    matches.forEach((m) => {
      if (typeof m.round !== "number") return; // solo matches swiss (round numérico)
      const poolKey = `${m.teamA.wins}-${m.teamA.losses}`;
      if (!grouped[poolKey]) grouped[poolKey] = [];
      grouped[poolKey].push(m);
    });
    return grouped;
  };

  // Obtener equipos que avanzaron (3 wins) o fueron eliminados (3 losses) desde un pool
  const getAdvancingTeams = (poolMatches) => {
    const teams = [];
    poolMatches.forEach((m) => {
      if (m.completed && m.result) {
        const winner = m.result.winner === m.teamA.id ? m.teamA : m.teamB;
        const loser = m.result.winner === m.teamA.id ? m.teamB : m.teamA;
        // El ganador de un pool 2-X avanza si ahora tiene 3 wins
        if (winner.wins + 1 >= 3) teams.push(winner);
      }
    });
    return teams;
  };

  const getEliminatedTeams = (poolMatches) => {
    const teams = [];
    poolMatches.forEach((m) => {
      if (m.completed && m.result) {
        const loser = m.result.winner === m.teamA.id ? m.teamB : m.teamA;
        if (loser.losses + 1 >= 3) teams.push(loser);
      }
    });
    return teams;
  };

  const matchesByPool = getMatchesByPool();

  return (
    <div className="min-h-screen p-4 md:p-8 text-white">
      <div className="mx-auto max-w-[1600px]">
        {/* Header */}
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-amber-500">
            {stage === "swiss"
              ? `SWISS STAGE — ROUND ${swissRound}`
              : stage === "swiss_complete"
                ? "SWISS STAGE — COMPLETE"
                : stage === "won"
                  ? "🏆 MAJOR CHAMPIONS"
                  : stage === "playoffs" || stage === "results_pending"
                    ? "PLAYOFFS"
                    : stage.toUpperCase()}
          </h1>

          {["swiss", "playoffs"].includes(stage) &&
            playerMatch &&
            !playerMatch.completed && (
              <button
                onClick={handlePlayMatch}
                className="rounded-lg bg-amber-600 px-6 py-3 font-bold text-sm uppercase tracking-wider hover:bg-amber-500 transition-all hover:scale-105 shadow-lg shadow-amber-600/30"
              >
                ▶ PLAY MATCH
              </button>
            )}
        </header>

        {/* SWISS STAGE VIEW */}
        {(stage === "swiss" ||
          stage === "swiss_complete" ||
          (stage === "results_pending" &&
            !matches.some((m) => typeof m.round === "string"))) && (
          <>
            <div className="overflow-x-auto pb-4">
              <div className="flex gap-2 min-w-[1200px]">
                {SWISS_STRUCTURE.map((col, colIdx) => {
                  const isCurrentOrPast = col.round <= swissRound;
                  const isFuture = col.round > swissRound;

                  return (
                    <div key={col.round} className="flex items-stretch gap-2">
                      {/* Columna de pools */}
                      <div className="flex flex-col gap-3 w-[220px]">
                        {col.pools.map((pool) => {
                          const poolKey = pool.record;
                          const poolM = matchesByPool[poolKey] || [];
                          const [w, l] = poolKey.split("-").map(Number);
                          const advTeams = pool.advancing
                            ? getAdvancingTeams(poolM)
                            : [];
                          const elimTeams = pool.eliminating
                            ? getEliminatedTeams(poolM)
                            : [];

                          return (
                            <div key={poolKey} className="flex flex-col">
                              {/* Label ADVANCING */}
                              {pool.advancing && (
                                <div className="mb-1">
                                  <div className="text-center text-xs font-bold text-green-500 tracking-wider mb-1">
                                    ADVANCING
                                  </div>
                                  <div className="bg-neutral-800/80 border border-green-900/50 rounded p-1.5 flex flex-wrap gap-1 justify-center min-h-[28px]">
                                    {advTeams.length > 0 ? (
                                      advTeams.map((t) => (
                                        <span
                                          key={t.id}
                                          className="text-[10px] font-bold text-green-400 bg-green-950/50 px-1.5 py-0.5 rounded"
                                        >
                                          {t.name}
                                        </span>
                                      ))
                                    ) : (
                                      <span className="text-[10px] text-neutral-600">
                                        ?
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Pool header */}
                              <div className="flex items-center justify-between bg-neutral-800 rounded-t px-3 py-1.5 border border-neutral-700 border-b-0">
                                <span className="text-[10px] text-neutral-500 font-mono">
                                  {String(poolM.length).padStart(2, "0")}/
                                  {String(pool.matchCount).padStart(2, "0")}
                                </span>
                                <span className="text-lg font-black text-white tracking-tight">
                                  {pool.record.replace("-", ":")}
                                </span>
                                <span className="text-[10px] text-neutral-500 font-mono">
                                  {pool.format}
                                </span>
                              </div>

                              {/* Match rows */}
                              <div
                                className={`border border-neutral-700 rounded-b bg-neutral-900/80 divide-y divide-neutral-800 ${isFuture ? "opacity-40" : ""}`}
                              >
                                {poolM.length > 0
                                  ? poolM.map((m) => (
                                      <SwissMatchRow key={m.id} m={m} />
                                    ))
                                  : // Placeholders para rondas futuras
                                    Array.from({ length: pool.matchCount }).map(
                                      (_, i) => (
                                        <div
                                          key={i}
                                          className="flex items-center justify-between px-2 py-1.5 text-neutral-600"
                                        >
                                          <span className="text-xs">?</span>
                                          <span className="text-[10px] font-bold">
                                            VS
                                          </span>
                                          <span className="text-xs">?</span>
                                        </div>
                                      ),
                                    )}
                              </div>

                              {/* Label ELIMINATED */}
                              {pool.eliminating && (
                                <div className="mt-1">
                                  <div className="text-center text-xs font-bold text-red-500 tracking-wider mb-1">
                                    ELIMINATED
                                  </div>
                                  <div className="bg-neutral-800/80 border border-red-900/50 rounded p-1.5 flex flex-wrap gap-1 justify-center min-h-[28px]">
                                    {elimTeams.length > 0 ? (
                                      elimTeams.map((t) => (
                                        <span
                                          key={t.id}
                                          className="text-[10px] font-bold text-red-400 bg-red-950/50 px-1.5 py-0.5 rounded"
                                        >
                                          {t.name}
                                        </span>
                                      ))
                                    ) : (
                                      <span className="text-[10px] text-neutral-600">
                                        ?
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Flechas decorativas entre columnas */}
                      {colIdx < SWISS_STRUCTURE.length - 1 && (
                        <div className="flex flex-col items-center justify-center w-[30px] gap-2">
                          <ChevronArrows direction="advance" />
                          {col.pools.length > 1 && (
                            <ChevronArrows direction="eliminate" />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Botón continuar a playoffs desde swiss_complete */}
            {stage === "swiss_complete" && (
              <div className="flex justify-center mt-6">
                <button
                  onClick={continueToPlayoffs}
                  className="rounded-lg bg-green-600 px-8 py-4 font-black text-lg uppercase tracking-wider hover:bg-green-500 transition-all hover:scale-105 shadow-lg shadow-green-600/30"
                >
                  CONTINUE TO PLAYOFFS →
                </button>
              </div>
            )}

            {/* Botón ver resultado final desde results_pending (eliminado en swiss) */}
            {stage === "results_pending" && (
              <div className="flex justify-center mt-6">
                <button
                  onClick={showFinalResult}
                  className="rounded-lg bg-amber-600 px-8 py-4 font-black text-lg uppercase tracking-wider hover:bg-amber-500 transition-all hover:scale-105 shadow-lg shadow-amber-600/30"
                >
                  VIEW FINAL RESULT
                </button>
              </div>
            )}
          </>
        )}

        {/* PLAYOFFS BRACKET VIEW */}
        {(stage === "playoffs" ||
          (stage === "results_pending" &&
            matches.some((m) => typeof m.round === "string"))) && (
          <>
            <PlayoffBracket matches={matches} />

            {/* Botón ver resultado final desde results_pending (playoffs) */}
            {stage === "results_pending" && (
              <div className="flex justify-center mt-6">
                <button
                  onClick={showFinalResult}
                  className="rounded-lg bg-amber-600 px-8 py-4 font-black text-lg uppercase tracking-wider hover:bg-amber-500 transition-all hover:scale-105 shadow-lg shadow-amber-600/30"
                >
                  VIEW FINAL RESULT
                </button>
              </div>
            )}
          </>
        )}

        {/* STANDINGS TABLE */}
        <section className="mt-8 rounded-xl border border-neutral-800 bg-neutral-900/80 backdrop-blur-sm p-6">
          <h2 className="mb-4 text-xl font-bold text-neutral-300">
            Swiss Standings
          </h2>
          <div className="overflow-hidden rounded-lg border border-neutral-700">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-800">
                <tr>
                  <th className="p-3 text-neutral-400 text-xs uppercase tracking-wider">
                    #
                  </th>
                  <th className="p-3 text-neutral-400 text-xs uppercase tracking-wider">
                    Team
                  </th>
                  <th className="p-3 text-center text-neutral-400 text-xs uppercase tracking-wider">
                    W
                  </th>
                  <th className="p-3 text-center text-neutral-400 text-xs uppercase tracking-wider">
                    L
                  </th>
                  <th className="p-3 text-center text-neutral-400 text-xs uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {[...standings]
                  .sort((a, b) => b.wins - a.wins || a.losses - b.losses)
                  .map((t, idx) => {
                    const status =
                      t.wins >= 3
                        ? "QUALIFIED"
                        : t.losses >= 3
                          ? "ELIMINATED"
                          : "ACTIVE";
                    return (
                      <tr
                        key={t.id}
                        className={`transition-colors ${t.isPlayer ? "bg-amber-900/20 text-amber-400" : "hover:bg-neutral-800/50"}`}
                      >
                        <td className="p-3 text-neutral-500 text-xs font-mono">
                          {idx + 1}
                        </td>
                        <td className="p-3 flex items-center gap-2">
                          {t.icon && (
                            <img src={t.icon} alt={t.name} width={20} height={20} className="rounded-sm shrink-0" />
                          )}
                          <div className="flex flex-col min-w-0">
                            <span className={`font-semibold text-sm truncate ${t.isPlayer ? "text-amber-400" : ""}`}>
                              {t.name} {t.isPlayer && "(You)"}
                            </span>
                            {t.major && <span className="text-[10px] text-neutral-500/70 -mt-0.5 truncate">{t.major}</span>}
                          </div>
                        </td>
                        <td className="p-3 text-center font-bold text-green-500">
                          {t.wins}
                        </td>
                        <td className="p-3 text-center font-bold text-red-500">
                          {t.losses}
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              status === "QUALIFIED"
                                ? "bg-green-900/50 text-green-400"
                                : status === "ELIMINATED"
                                  ? "bg-red-900/50 text-red-400"
                                  : "bg-neutral-800 text-neutral-500"
                            }`}
                          >
                            {status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </section>

        {/* MODALS */}
        {stage === "eliminated" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="text-center bg-neutral-900 border border-neutral-700 p-8 rounded-xl max-w-2xl w-full mx-4 shadow-2xl">
              <h2 className="mb-4 text-6xl font-bold text-red-600">
                ELIMINATED
              </h2>
              <p className="mb-8 text-2xl text-neutral-300">
                Your team was knocked out of the Major.
              </p>
              <TeamSummary standings={standings} mySquad={mySquad} />
              <button
                onClick={() => router.push("/")}
                className="rounded bg-neutral-800 px-8 py-4 font-bold hover:bg-neutral-700 w-full mt-4"
              >
                BACK TO HOME
              </button>
            </div>
          </div>
        )}

        {stage === "won" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="text-center bg-neutral-900 border border-neutral-700 p-8 rounded-xl max-w-2xl w-full mx-4 shadow-2xl border-amber-500/50">
              <h2 className="mb-4 text-6xl font-bold text-amber-500">
                MAJOR CHAMPIONS!
              </h2>
              <p className="mb-8 text-2xl text-neutral-300">
                You won the Grand Final!
              </p>
              <TeamSummary standings={standings} mySquad={mySquad} />
              <button
                onClick={() => router.push("/")}
                className="rounded bg-amber-600 px-8 py-4 font-bold text-white hover:bg-amber-500 w-full mt-4"
              >
                BACK TO HOME
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ========================= */
/* COMPONENTES SWISS         */
/* ========================= */

function SwissMatchRow({ m }) {
  const isWinnerA = m.completed && m.result?.winner === m.teamA.id;
  const isWinnerB = m.completed && m.result?.winner === m.teamB.id;

  return (
    <div
      className={`flex items-center justify-between px-3 py-2 ${m.isPlayerMatch ? "bg-amber-500/10 border-l-2 border-l-amber-500" : ""}`}
    >
      {/* Team A */}
      <div 
        className={`flex items-center justify-center w-10 h-10 bg-neutral-800 rounded-md transition-all shrink-0 ${isWinnerA ? "ring-2 ring-white" : m.completed ? "opacity-40 grayscale" : ""}`}
        title={`${m.teamA.name}${m.teamA.major ? ` - ${m.teamA.major}` : ""}`}
      >
        {m.teamA.icon ? (
          <img src={m.teamA.icon} alt={m.teamA.name} className="w-8 h-8 object-contain" />
        ) : (
          <span className="text-[10px] font-bold text-neutral-500 uppercase">{m.teamA.name.slice(0, 3)}</span>
        )}
      </div>

      {/* Score */}
      <div className="flex items-center justify-center gap-2 font-mono flex-1">
        {m.completed ? (
          <>
            <span className={`text-sm font-bold ${isWinnerA ? "text-green-400" : "text-neutral-500"}`}>{m.result.scoreA}</span>
            <span className="text-neutral-700">-</span>
            <span className={`text-sm font-bold ${isWinnerB ? "text-green-400" : "text-neutral-500"}`}>{m.result.scoreB}</span>
          </>
        ) : (
          <span className="text-neutral-600 text-[10px] font-bold">VS</span>
        )}
      </div>

      {/* Team B */}
      <div 
        className={`flex items-center justify-center w-10 h-10 bg-neutral-800 rounded-md transition-all shrink-0 ${isWinnerB ? "ring-2 ring-white" : m.completed ? "opacity-40 grayscale" : ""}`}
        title={`${m.teamB.name}${m.teamB.major ? ` - ${m.teamB.major}` : ""}`}
      >
        {m.teamB.icon ? (
          <img src={m.teamB.icon} alt={m.teamB.name} className="w-8 h-8 object-contain" />
        ) : (
          <span className="text-[10px] font-bold text-neutral-500 uppercase">{m.teamB.name.slice(0, 3)}</span>
        )}
      </div>
    </div>
  );
}

function ChevronArrows({ direction }) {
  const color = direction === "advance" ? "text-green-600" : "text-red-700";
  return (
    <div className={`flex flex-col items-center ${color} opacity-60`}>
      <span className="text-[10px] leading-none">›››</span>
    </div>
  );
}

/* ========================= */
/* COMPONENTE PLAYOFF BRACKET */
/* ========================= */

function PlayoffBracket({ matches }) {
  const qf = matches
    .filter((m) => m.round === "Quarterfinals")
    .sort((a, b) => a.id.localeCompare(b.id));
  const sf = matches
    .filter((m) => m.round === "Semifinals")
    .sort((a, b) => a.id.localeCompare(b.id));
  const final = matches.find((m) => m.round === "Final");

  const getWinner = (m) => {
    if (!m || !m.completed || !m.result) return null;
    return m.result.winner === m.teamA.id ? m.teamA : m.teamB;
  };

  const champion = final ? getWinner(final) : null;

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex items-center gap-0 min-w-[900px] py-4">
        {/* Quarterfinals */}
        <div className="flex flex-col justify-around h-[500px] w-[240px]">
          {qf.map((m, i) => (
            <BracketMatchCard key={m.id} m={m} />
          ))}
          {/* Placeholders si no hay 4 QF */}
          {Array.from({ length: Math.max(0, 4 - qf.length) }).map((_, i) => (
            <BracketMatchCard key={`qf-tbd-${i}`} m={null} />
          ))}
        </div>

        {/* Conectores QF → SF */}
        <BracketConnectors count={4} />

        {/* Semifinals */}
        <div className="flex flex-col justify-around h-[500px] w-[240px]">
          {sf.map((m) => (
            <BracketMatchCard key={m.id} m={m} />
          ))}
          {Array.from({ length: Math.max(0, 2 - sf.length) }).map((_, i) => (
            <BracketMatchCard key={`sf-tbd-${i}`} m={null} />
          ))}
        </div>

        {/* Conectores SF → Final */}
        <BracketConnectors count={2} />

        {/* Final */}
        <div className="flex flex-col justify-center h-[500px] w-[240px]">
          <BracketMatchCard m={final || null} />
        </div>

        {/* Conector Final → Champion */}
        <div className="flex items-center w-[40px] h-[500px] justify-center">
          <div className="w-full h-[2px] border-t-2 border-dashed border-neutral-700" />
        </div>

        {/* Champion */}
        <div className="flex flex-col justify-center h-[500px] w-[180px]">
          {champion ? (
            <div className="border-2 border-amber-500 rounded-xl p-4 bg-amber-500/10 text-center shadow-lg shadow-amber-500/20">
              {champion.icon && (
                <img src={champion.icon} alt={champion.name} width={48} height={48} className="mx-auto mb-2 rounded" />
              )}
              <div className="text-amber-400 font-black text-sm">{champion.name}</div>
              {champion.major && <div className="text-[10px] text-amber-500/70 -mt-0.5 mb-2">{champion.major}</div>}
              <div className="text-[10px] text-amber-600 font-bold tracking-wider mt-1">🏆 CHAMPION</div>
            </div>
          ) : (
            <div className="border-2 border-dashed border-neutral-700 rounded-xl p-4 text-center">
              <div className="text-neutral-600 font-bold text-sm">TBD</div>
              <div className="text-[10px] text-neutral-700 mt-1">CHAMPION</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BracketMatchCard({ m }) {
  if (!m) {
    return (
      <div className="border border-dashed border-neutral-700 rounded-lg p-3 bg-neutral-900/50">
        <div className="flex items-center justify-between py-1 text-neutral-600 text-xs">
          <span>TBD</span>
          <span className="font-mono">-</span>
        </div>
        <div className="border-t border-neutral-800 my-0.5" />
        <div className="flex items-center justify-between py-1 text-neutral-600 text-xs">
          <span>TBD</span>
          <span className="font-mono">-</span>
        </div>
      </div>
    );
  }

  const isWinnerA = m.completed && m.result?.winner === m.teamA.id;
  const isWinnerB = m.completed && m.result?.winner === m.teamB.id;

  return (
    <div className={`border rounded-lg overflow-hidden ${m.isPlayerMatch ? "border-amber-500 shadow-md shadow-amber-500/20" : "border-neutral-700"} bg-neutral-900`}>
      {/* Team A */}
      <div className={`flex items-center gap-2 px-3 py-2 ${isWinnerA ? "bg-green-900/20" : m.completed ? "opacity-50" : ""}`}>
        {m.teamA.icon && (
          <img src={m.teamA.icon} alt={m.teamA.name} width={20} height={20} className="rounded-sm shrink-0" />
        )}
        <div className="flex flex-col flex-1 min-w-0">
          <span className={`text-xs font-bold truncate ${isWinnerA ? "text-white" : m.completed ? "text-neutral-500" : "text-neutral-300"}`}>
            {m.teamA.name}
          </span>
          {m.teamA.major && <span className="truncate text-[9px] text-neutral-500/70 -mt-0.5">{m.teamA.major}</span>}
        </div>
        <span className={`text-sm font-black font-mono ${isWinnerA ? "text-green-400" : m.completed ? "text-neutral-600" : "text-neutral-500"}`}>
          {m.completed ? m.result.scoreA : "-"}
        </span>
      </div>

      <div className="border-t border-neutral-800" />

      {/* Team B */}
      <div className={`flex items-center gap-2 px-3 py-2 ${isWinnerB ? "bg-green-900/20" : m.completed ? "opacity-50" : ""}`}>
        {m.teamB.icon && (
          <img src={m.teamB.icon} alt={m.teamB.name} width={20} height={20} className="rounded-sm shrink-0" />
        )}
        <div className="flex flex-col flex-1 min-w-0">
          <span className={`text-xs font-bold truncate ${isWinnerB ? "text-white" : m.completed ? "text-neutral-500" : "text-neutral-300"}`}>
            {m.teamB.name}
          </span>
          {m.teamB.major && <span className="truncate text-[9px] text-neutral-500/70 -mt-0.5">{m.teamB.major}</span>}
        </div>
        <span className={`text-sm font-black font-mono ${isWinnerB ? "text-green-400" : m.completed ? "text-neutral-600" : "text-neutral-500"}`}>
          {m.completed ? m.result.scoreB : "-"}
        </span>
      </div>
    </div>
  );
}

function BracketConnectors({ count }) {
  // Genera líneas SVG conectoras entre rondas del bracket
  const height = 500;
  const segmentHeight = height / count;
  const halfSegment = segmentHeight / 2;

  return (
    <div className="w-[40px] h-[500px] relative">
      <svg width="40" height={height} className="absolute inset-0">
        {Array.from({ length: count / 2 }).map((_, pairIdx) => {
          const topMatchCenter = pairIdx * 2 * segmentHeight + halfSegment;
          const bottomMatchCenter =
            (pairIdx * 2 + 1) * segmentHeight + halfSegment;
          const midY = (topMatchCenter + bottomMatchCenter) / 2;

          return (
            <g key={pairIdx}>
              {/* Línea horizontal desde match superior */}
              <line
                x1="0"
                y1={topMatchCenter}
                x2="15"
                y2={topMatchCenter}
                stroke="#404040"
                strokeWidth="2"
                strokeDasharray="4 3"
              />
              {/* Línea vertical conectora */}
              <line
                x1="15"
                y1={topMatchCenter}
                x2="15"
                y2={bottomMatchCenter}
                stroke="#404040"
                strokeWidth="2"
                strokeDasharray="4 3"
              />
              {/* Línea horizontal desde match inferior */}
              <line
                x1="0"
                y1={bottomMatchCenter}
                x2="15"
                y2={bottomMatchCenter}
                stroke="#404040"
                strokeWidth="2"
                strokeDasharray="4 3"
              />
              {/* Línea horizontal hacia siguiente ronda */}
              <line
                x1="15"
                y1={midY}
                x2="40"
                y2={midY}
                stroke="#404040"
                strokeWidth="2"
                strokeDasharray="4 3"
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ========================= */
/* COMPONENTE TEAM SUMMARY   */
/* ========================= */

function TeamSummary({ standings, mySquad }) {
  const playerRecord = standings.find((t) => t.isPlayer);
  const { matches } = useTournament();

  let placement = "Swiss Stage";
  if (playerRecord?.wins === 3) {
    const qfLost = matches.find(
      (m) =>
        m.round === "Quarterfinals" &&
        m.completed &&
        (m.teamA.id === playerRecord.id || m.teamB.id === playerRecord.id) &&
        m.result.winner !== playerRecord.id,
    );
    const sfLost = matches.find(
      (m) =>
        m.round === "Semifinals" &&
        m.completed &&
        (m.teamA.id === playerRecord.id || m.teamB.id === playerRecord.id) &&
        m.result.winner !== playerRecord.id,
    );
    const fLost = matches.find(
      (m) =>
        m.round === "Final" &&
        m.completed &&
        (m.teamA.id === playerRecord.id || m.teamB.id === playerRecord.id) &&
        m.result.winner !== playerRecord.id,
    );
    const fWon = matches.find(
      (m) =>
        m.round === "Final" &&
        m.completed &&
        (m.teamA.id === playerRecord.id || m.teamB.id === playerRecord.id) &&
        m.result.winner === playerRecord.id,
    );

    if (fWon) placement = "1st Place (Champion)";
    else if (fLost) placement = "2nd Place";
    else if (sfLost) placement = "3rd-4th Place";
    else if (qfLost) placement = "5th-8th Place";
    else placement = "Playoffs";
  } else {
    if (playerRecord?.wins === 0) placement = "15th-16th Place";
    else if (playerRecord?.wins === 1) placement = "12th-14th Place";
    else if (playerRecord?.wins === 2) placement = "9th-11th Place";
    else placement = "Eliminated";
  }

  let mvp = null;
  const finalMatch = matches.find((m) => m.round === "Final" && m.completed);
  if (finalMatch) {
    const finalists = [finalMatch.teamA, finalMatch.teamB];
    let bestPlayer = null;
    let bestRating = 0;
    let mvpTeamName = "";

    const getPseudoRating = (p) => {
      let hash = 0;
      for (let i = 0; i < p.name.length; i++) hash += p.name.charCodeAt(i);
      const baseStat = ((p.aim || 80) + (p.gamesense || 80)) / 2;
      const boost = (hash % 40) / 100;
      return baseStat / 70 + boost;
    };

    finalists.forEach((team) => {
      team.players?.forEach((p) => {
        const rating = getPseudoRating(p);
        if (rating > bestRating) {
          bestRating = rating;
          bestPlayer = p;
          mvpTeamName = team.name;
        }
      });
    });

    if (bestPlayer) {
      mvp = {
        name: bestPlayer.name,
        rating: bestRating.toFixed(2),
        team: mvpTeamName,
      };
    }
  }

  return (
    <div className="mb-4 p-4 bg-neutral-800 rounded-lg text-left">
      <h3 className="text-xl font-bold mb-4 text-amber-500 border-b border-neutral-700 pb-2">
        My Team
      </h3>
      <div className="flex flex-col gap-2 mb-6">
        <div className="flex justify-between p-2 rounded bg-amber-600/20 border border-amber-500/50">
          <div className="flex items-center gap-2">
            {playerRecord.icon && (
              <img
                src={playerRecord.icon}
                alt=""
                width={20}
                height={20}
                className="rounded-sm"
              />
            )}
            <span className="font-bold text-amber-400">
              {playerRecord.name} (You)
            </span>
          </div>
          <div className="text-sm font-mono text-neutral-400">
            {placement} | {playerRecord.wins}-{playerRecord.losses}
          </div>
        </div>
      </div>

      {mvp && (
        <>
          <h3 className="text-xl font-bold mb-4 text-blue-400 border-b border-neutral-700 pb-2">
            Tournament MVP
          </h3>
          <div className="bg-gradient-to-r from-blue-900/40 to-neutral-900 border border-blue-800/50 p-4 rounded-lg flex items-center justify-between">
            <div>
              <div className="text-2xl font-black text-white">{mvp.name}</div>
              <div className="text-sm font-bold text-blue-400">{mvp.team}</div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-black text-amber-400">
                {mvp.rating}
              </div>
              <div className="text-[10px] text-neutral-500 font-bold tracking-widest">
                RATING 3.0
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
