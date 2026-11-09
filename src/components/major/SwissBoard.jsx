import TeamMark from "./TeamMark";
import { poolsByRecord } from "@/lib/swissPools.mjs";

// Pools per round, keyed by the record the teams carried into the match.
const SWISS_STRUCTURE = [
  { round: 1, pools: [{ record: "0-0", matchCount: 8, format: "BO1" }] },
  { round: 2, pools: [{ record: "1-0", matchCount: 4, format: "BO1" }, { record: "0-1", matchCount: 4, format: "BO1" }] },
  { round: 3, pools: [{ record: "2-0", matchCount: 2, format: "BO3", advancing: true }, { record: "1-1", matchCount: 4, format: "BO1" }, { record: "0-2", matchCount: 2, format: "BO3", eliminating: true }] },
  { round: 4, pools: [{ record: "2-1", matchCount: 3, format: "BO3", advancing: true }, { record: "1-2", matchCount: 3, format: "BO3", eliminating: true }] },
  { round: 5, pools: [{ record: "2-2", matchCount: 3, format: "BO3", advancing: true, eliminating: true }] },
];

const winnerOf = m => m.result.winner === m.teamA.id ? m.teamA : m.teamB;
const loserOf = m => m.result.winner === m.teamA.id ? m.teamB : m.teamA;

function MatchRow({ m, mine, onTeamClick }) {
  const winA = m.completed && m.result?.winner === m.teamA.id;
  const winB = m.completed && m.result?.winner === m.teamB.id;
  return (
    <li className={`flex h-11 items-center gap-2 px-2 ${mine ? "bg-raised" : ""}`}>
      <TeamMark team={m.teamA} dim={m.completed && !winA} onClick={onTeamClick} />
      <span className="tabular flex flex-1 items-center justify-center gap-2 text-[13px]">
        {m.completed && m.result?.forfeit ? <span>W/O</span> : m.completed ? <>
          <span className={winA ? (mine && m.teamA.isPlayer ? "text-accent" : "text-ink") : "text-ink-3"}>{m.result.scoreA}</span>
          <span className="text-ink-3">–</span>
          <span className={winB ? (mine && m.teamB.isPlayer ? "text-accent" : "text-ink") : "text-ink-3"}>{m.result.scoreB}</span>
        </> : <span className={mine ? "text-ink-2" : "text-ink-3"}>{mine ? "Your match" : "vs"}</span>}
      </span>
      <TeamMark team={m.teamB} dim={m.completed && !winB} onClick={onTeamClick} />
    </li>
  );
}

function Outcome({ label, tone, teams, onTeamClick }) {
  return (
    <div className="my-2 px-1">
      <p className="meta flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full" style={{ background: tone }} aria-hidden="true" />{label}</p>
      <div className="mt-1 flex min-h-8 flex-wrap gap-1">
        {teams.length ? teams.map(t => <TeamMark key={t.id} team={t} size={20} onClick={onTeamClick} />) : <span className="meta leading-8">—</span>}
      </div>
    </div>
  );
}

export default function SwissBoard({ matches, swissRound, isMine, onTeamClick }) {
  const pools = poolsByRecord(matches);
  return (
    <div className="overflow-x-auto pb-2">
      <div className="grid min-w-[1080px] grid-cols-5 gap-4">
        {SWISS_STRUCTURE.map(col => (
          <section key={col.round} aria-label={`Round ${col.round}`} className="flex flex-col gap-4">
            <h3 className={`text-[13px] ${col.round === swissRound ? "text-ink" : "text-ink-3"}`}>Round {col.round}</h3>
            <div className="flex flex-1 flex-col justify-center gap-4">
            {col.pools.map(pool => {
              const poolMatches = pools[pool.record] || [];
              const played = poolMatches.filter(m => m.completed).length;
              const future = col.round > swissRound && poolMatches.length === 0;
              return (
                <div key={pool.record}>
                  {pool.advancing && <Outcome label="Advanced" tone="var(--positive)" onTeamClick={onTeamClick}
                    teams={poolMatches.filter(m => m.completed && m.result).map(winnerOf)} />}
                  <div className={`card overflow-hidden ${future ? "opacity-50" : ""}`}>
                    <div className="flex h-10 items-center justify-between px-3">
                      <span className="tabular text-[16px] font-medium">{pool.record.replace("-", "–")}</span>
                      <span className="meta tabular">{pool.format} · {future ? "not started" : `${played}/${pool.matchCount}`}</span>
                    </div>
                    <ul>
                      {poolMatches.length
                        ? poolMatches.map(m => <MatchRow key={m.id} m={m} mine={isMine(m)} onTeamClick={onTeamClick} />)
                        : Array.from({ length: pool.matchCount }, (_, i) => <li key={i} className="flex h-11 items-center justify-center text-[13px] text-ink-3">—</li>)}
                    </ul>
                  </div>
                  {pool.eliminating && <Outcome label="Eliminated" tone="var(--negative)" onTeamClick={onTeamClick}
                    teams={poolMatches.filter(m => m.completed && m.result).map(loserOf)} />}
                </div>
              );
            })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
