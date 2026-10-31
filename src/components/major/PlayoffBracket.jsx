import TeamName from "./TeamName";
import TeamMark from "./TeamMark";

function Side({ team, score, won, done, mine, onTeamClick }) {
  return (
    <div className="flex h-11 items-center gap-2 px-2">
      <TeamMark team={team} size={20} dim={done && !won} onClick={onTeamClick} />
      <TeamName team={team} className={`flex-1 ${done && !won ? "text-ink-3" : mine ? "text-accent" : "text-ink"}`} />
      <span className={`tabular min-w-6 text-right ${won ? "text-ink" : "text-ink-3"}`}>{done ? score : ""}</span>
    </div>
  );
}

function MatchCard({ m, isMine, onTeamClick }) {
  if (!m) return (
    <div className="card">
      <div className="flex h-11 items-center px-3 text-ink-3">To be decided</div>
      <div className="flex h-11 items-center px-3 text-ink-3">To be decided</div>
    </div>
  );
  const done = m.completed && m.result;
  const mine = isMine(m);
  return (
    <div className={`card overflow-hidden ${mine ? "bg-raised" : ""}`}>
      <Side team={m.teamA} score={m.result?.forfeit ? (m.result.winner === m.teamA.id ? "W/O" : "") : m.result?.scoreA} won={done && m.result.winner === m.teamA.id} done={done} mine={mine && m.teamA.isPlayer} onTeamClick={onTeamClick} />
      <Side team={m.teamB} score={m.result?.forfeit ? (m.result.winner === m.teamB.id ? "W/O" : "") : m.result?.scoreB} won={done && m.result.winner === m.teamB.id} done={done} mine={mine && m.teamB.isPlayer} onTeamClick={onTeamClick} />
    </div>
  );
}

function Column({ title, format, children }) {
  return (
    <section aria-label={title} className="flex flex-col">
      <h3 className="text-[13px] text-ink-2">{title} <span className="text-ink-3">· {format}</span></h3>
      <div className="mt-4 flex flex-1 flex-col justify-around gap-4">{children}</div>
    </section>
  );
}

export default function PlayoffBracket({ matches, isMine, onTeamClick }) {
  const round = name => matches.filter(m => m.round === name).sort((a, b) => a.id.localeCompare(b.id));
  const qf = round("Quarterfinals"), sf = round("Semifinals"), final = matches.find(m => m.round === "Final");
  const champion = final?.completed && final.result ? (final.result.winner === final.teamA.id ? final.teamA : final.teamB) : null;
  const pad = (list, n) => [...list, ...Array(Math.max(0, n - list.length)).fill(null)];
  return (
    <div className="overflow-x-auto pb-2">
      <div className="grid min-h-[480px] min-w-[960px] grid-cols-4 gap-6">
        <Column title="Quarterfinals" format="BO3">
          {pad(qf, 4).map((m, i) => <MatchCard key={m?.id || `qf-${i}`} m={m} isMine={isMine} onTeamClick={onTeamClick} />)}
        </Column>
        <Column title="Semifinals" format="BO3">
          {pad(sf, 2).map((m, i) => <MatchCard key={m?.id || `sf-${i}`} m={m} isMine={isMine} onTeamClick={onTeamClick} />)}
        </Column>
        <Column title="Final" format="BO5">
          <MatchCard m={final || null} isMine={isMine} onTeamClick={onTeamClick} />
        </Column>
        <Column title="Champion" format="Major winner">
          <div className="card flex flex-col items-center justify-center gap-3 p-6 text-center">
            {champion ? <>
              <TeamMark team={champion} size={48} onClick={onTeamClick} />
              <TeamName team={champion} className={`text-[16px] font-medium ${champion.isPlayer ? "text-accent" : ""}`} />
            </> : <span className="text-ink-3">To be decided</span>}
          </div>
        </Column>
      </div>
    </div>
  );
}
