import { matchFormat, record } from "@/lib/majorDisplay.mjs";
import TeamName from "./TeamName";
import TeamMark from "./TeamMark";

function Team({ team, mine, align, onTeamClick }) {
  return (
    <div className={`flex min-w-0 items-center gap-3 ${align === "right" ? "flex-row-reverse text-right" : ""}`}>
      <TeamMark team={team} size={40} onClick={onTeamClick} />
      <span className="min-w-0">
        <TeamName team={team} className={`block text-[20px] font-medium ${mine ? "text-accent" : ""}`} />
        <span className="meta tabular">{record(team)}</span>
      </span>
    </div>
  );
}

// The player's match for the round: who, what format, and the one action.
export default function MatchupCard({ match, isMineTeam, label, children, onTeamClick }) {
  return (
    <section className="card flex flex-col gap-6 p-6 lg:flex-row lg:items-end lg:justify-between" aria-labelledby="matchup-title">
      <div className="min-w-0 lg:w-[720px]">
        <h2 id="matchup-title" className="meta">{label} · {matchFormat(match)}{typeof match.round === "string" ? ` · ${match.round}` : ""}</h2>
        <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-6">
          <Team team={match.teamA} mine={isMineTeam(match.teamA)} onTeamClick={onTeamClick} />
          <span className="text-ink-3">vs</span>
          <Team team={match.teamB} mine={isMineTeam(match.teamB)} align="right" onTeamClick={onTeamClick} />
        </div>
      </div>
      {children && <div className="flex flex-wrap items-center gap-4">{children}</div>}
    </section>
  );
}
