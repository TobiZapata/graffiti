import { record } from "@/lib/majorDisplay.mjs";
import TeamName from "./TeamName";
import TeamMark from "./TeamMark";

const status = t => t.wins >= 3 ? ["Qualified", "text-positive"] : t.losses >= 3 ? ["Eliminated", "text-ink-3"] : ["Playing", "text-ink-2"];

export default function StandingsTable({ standings, isMine, onTeamClick }) {
  const rows = [...standings].sort((a, b) => b.wins - a.wins || a.losses - b.losses);
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
                    <span className="flex items-center gap-2">
                      <TeamMark team={t} size={20} onClick={onTeamClick} />
                      <TeamName team={t} className={mine ? "text-accent" : ""} />{mine && <span className="shrink-0 text-ink-3">you</span>}
                    </span>
                  </td>
                  <td className="tabular text-right">{record(t)}</td>
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
