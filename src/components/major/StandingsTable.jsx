import { record } from "@/lib/majorDisplay.mjs";
import TeamMark from "./TeamMark";
import { swissRoundResult } from "@/lib/swissStandings.mjs";

const status = t => t.wins >= 3 ? ["Qualified", "text-positive"] : t.losses >= 3 ? ["Eliminated", "text-ink-3"] : ["Playing", "text-ink-2"];

export default function StandingsTable({ standings, matches = [], isMine, onTeamClick }) {
  const rows = [...standings].sort((a, b) => b.wins - a.wins || a.losses - b.losses);
  const rounds = [...new Set(matches.map(match => match.round).filter(round => Number.isInteger(round) && round >= 1 && round <= 5))].sort((a, b) => a - b);
  return (
    <section className="card p-6" aria-labelledby="standings-title">
      <h2 id="standings-title" className="text-[16px] font-medium">Swiss standings</h2>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[480px] text-left">
          <thead>
            <tr className="meta h-9">
              <th scope="col" className="w-10 font-normal">#</th>
              <th scope="col" className="font-normal">Team</th>
              <th scope="col" className="w-24 text-right font-normal">Record</th>
              {rounds.map(round => <th key={round} scope="col" className="min-w-24 px-3 text-center font-normal">Round {round}</th>)}
              <th scope="col" className="w-32 text-right font-normal">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t, i) => {
              const [label, tone] = status(t);
              const mine = isMine(t);
              return (
                <tr key={t.id} className="h-12 border-t border-rule">
                  <td className="tabular text-ink-3">{i + 1}</td>
                  <td>
                    <span className="flex min-w-40 items-center gap-2 py-2">
                      <TeamMark team={t} size={20} onClick={onTeamClick} />
                      <span className="min-w-0"><span className={mine ? "text-accent" : ""}>{t.name}</span>{t.major && !t.uid && !t.isPlayer && <span className="mt-1 block text-[12px] text-ink-3">{t.major}</span>}</span>{mine && <span className="shrink-0 text-ink-3">you</span>}
                    </span>
                  </td>
                  <td className="tabular text-right">{record(t)}</td>
                  {rounds.map(round => {
                    const result = swissRoundResult(matches, t.id, round);
                    return <td key={round} className="px-3 text-center">
                      {result ? <span className="flex items-center justify-center gap-1" title={`Round ${round} vs ${result.opponent.name}${result.completed ? `: ${result.score}` : ': pending'}`}>
                        <TeamMark team={result.opponent} size={16} onClick={onTeamClick} />
                        <span className={`tabular text-[12px] ${!result.completed ? "text-ink-3" : result.won ? "text-positive" : "text-negative"}`}>{result.score}</span>
                      </span> : <span className="text-ink-3">—</span>}
                    </td>;
                  })}
                  <td className={`text-right ${tone}`}>{label}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
