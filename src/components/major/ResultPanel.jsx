import { record } from "@/lib/majorDisplay.mjs";
import TeamMark from "./TeamMark";
import TeamName from "./TeamName";

// The close of a Major: where each human team finished.
export default function ResultPanel({ title, teams, children, onTeamClick }) {
  return (
    <section className="card p-6 sm:p-8" aria-labelledby="result-title">
      <p className="meta">Major finished</p>
      <h2 id="result-title" className="mt-1 text-[28px] font-medium leading-tight">{title}</h2>
      <div className="mt-6">
        <ul aria-label="Final placings">
          {teams.map(t => (
            <li key={t.id} className="flex min-h-14 flex-wrap items-center gap-3 border-t border-rule py-3 first:border-t-0">
              <TeamMark team={t} size={28} onClick={onTeamClick} />
              <TeamName team={t} className="flex-1 text-[16px]" />
              <span className="tabular text-ink-2">Swiss stage {record(t)}</span>
              <span className={`w-full sm:w-44 sm:text-right ${t.placement.weight === 1 ? "text-accent" : ""}`}>{t.placement.text}</span>
            </li>
          ))}
        </ul>
      </div>
      {children && <div className="mt-8 flex flex-wrap items-center gap-4">{children}</div>}
    </section>
  );
}
