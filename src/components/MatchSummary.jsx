"use client";
import PlayerIdentity from "@/components/PlayerIdentity";

import { useState } from "react";
import Link from "next/link";
import TeamMark from "./major/TeamMark";
import TeamName from "./major/TeamName";
import { replayBestOf } from "@/lib/replaySeries.mjs";
import { summarizeMatchPlayers } from "@/lib/matchSummary.mjs";

const mapName = (map) => (map?.map || "Unknown map").replace(/^de_/, "").replace(/^./, c => c.toUpperCase());
const value = (n) => n == null ? "—" : n;
const decimal = (n, digits = 1) => n == null ? "—" : n.toFixed(digits);
const percentage = (n) => n == null ? "—" : `${decimal(n)}%`;
const swingValue = (n) => n == null ? "—" : `${n >= 0.05 ? "+" : ""}${decimal(Math.abs(n) < 0.05 ? 0 : n)}%`;

function PlayerTable({ team, players }) {
  const sorted = players.toSorted((a, b) => {
    if ((a.rating == null) !== (b.rating == null)) return a.rating == null ? 1 : -1;
    return (b.rating ?? 0) - (a.rating ?? 0) || (b.kills ?? 0) - (a.kills ?? 0);
  });
  return <section className="min-w-0" aria-label={`${team.name} player statistics`}>
    <div className="flex items-center gap-2 border-b border-rule-strong pb-3">
      <TeamMark team={team} size={24} /><TeamName team={team} className="font-medium" />
    </div>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[440px] text-sm">
        <thead className="text-xs text-ink-3"><tr>
          <th scope="col" className="py-3 pr-4 text-left font-normal">Player</th>
          <th scope="col" className="px-2 text-right font-normal" title="Kills and deaths">K-D</th>
          <th scope="col" className="px-2 text-right font-normal" title="Average change in round win probability from kills and deaths">Swing</th>
          <th scope="col" className="px-2 text-right font-normal"><abbr title="Average damage per round" className="no-underline">ADR</abbr></th>
          <th scope="col" className="px-2 text-right font-normal"><abbr title="Rounds with a kill, assist, survival or traded death" className="no-underline">KAST</abbr></th>
          <th scope="col" className="pl-2 text-right font-normal" title="Simulator rating">Rating</th>
        </tr></thead>
        <tbody>{sorted.map(player => <tr key={player.uid} className="border-t border-rule">
          <th scope="row" className="py-3 pr-4 text-left font-normal"><PlayerIdentity player={player} /></th>
          <td className="tabular whitespace-nowrap px-2 text-right">{player.kills == null || player.deaths == null ? "—" : `${player.kills}-${player.deaths}`}</td>
          <td className="tabular px-2 text-right">{swingValue(player.swing)}</td>
          <td className="tabular px-2 text-right">{decimal(player.adr)}</td>
          <td className="tabular px-2 text-right">{percentage(player.kast)}</td>
          <td className="tabular pl-2 text-right">{decimal(player.rating, 2)}</td>
        </tr>)}</tbody>
      </table>
    </div>
  </section>;
}

export default function MatchSummary({ match, result, saving = false, loadingStats = false, error = "", onRetry, backHref = "/simulation" }) {
  const [selected, setSelected] = useState(-1);
  const maps = result?.maps || [];
  const selection = selected < maps.length ? selected : -1;
  const stats = summarizeMatchPlayers(match, selection < 0 ? maps : [maps[selection]]);
  const winner = [match.teamA, match.teamB].find(team => team.id === result?.winner);
  const locked = saving || Boolean(error);
  const bestOf = replayBestOf(match);

  return <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="meta">{match.round} · BO{bestOf}</p><h1 className="mt-1 text-2xl font-medium">Match summary</h1></div>
      {locked ? <button type="button" disabled className="btn btn-primary btn-lg">Back to Major</button> : <Link href={backHref} className="btn btn-primary btn-lg">Back to Major</Link>}
    </div>
    <div className="mt-4 min-h-6 text-sm text-ink-2">
      {saving ? <p role="status">Saving result…</p> : error ? <p role="alert">{error} {onRetry && <button type="button" onClick={onRetry} className="underline underline-offset-4">Retry save</button>}</p> : <p role="status">Result saved</p>}
    </div>
    <section className="card mt-5 p-5 sm:p-8" aria-label="Final result">
      <p className="text-center text-sm text-ink-2">{winner ? `${winner.name} wins` : "Match complete"}{result?.forfeit ? " · W/O" : ""}</p>
      <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-6">
        <div className="flex min-w-0 flex-col items-center gap-2 text-center sm:flex-row sm:justify-end" title={match.teamA.name}><TeamMark team={match.teamA} size={40} /><TeamName team={match.teamA} className="max-w-full font-medium" /></div>
        <div className="tabular whitespace-nowrap text-3xl font-medium sm:text-4xl" aria-label={`${result?.scoreA ?? "unknown"} to ${result?.scoreB ?? "unknown"}`}>{value(result?.scoreA)} <span className="text-ink-3">:</span> {value(result?.scoreB)}</div>
        <div className="flex min-w-0 flex-col items-center gap-2 text-center sm:flex-row" title={match.teamB.name}><TeamMark team={match.teamB} size={40} /><TeamName team={match.teamB} className="max-w-full font-medium" /></div>
      </div>
      <p className="mt-3 text-center text-xs text-ink-3">{bestOf === 1 ? "Rounds" : "Maps"}</p>
    </section>
    {maps.length > 0 && <div className="mt-8 overflow-x-auto border-b border-rule-strong" aria-label="Select map">
      <div className="flex min-w-max gap-6">
        <button type="button" aria-pressed={selection === -1} onClick={() => setSelected(-1)} className={`min-h-11 border-b-2 ${selection === -1 ? "border-ink text-ink" : "border-transparent text-ink-2"}`}>All maps</button>
        {maps.map((map, i) => <button key={i} type="button" aria-pressed={selection === i} onClick={() => setSelected(i)} className={`min-h-11 border-b-2 ${selection === i ? "border-ink text-ink" : "border-transparent text-ink-2"}`}>Map {i + 1} · {mapName(map)} <span className="tabular">{map.scoreA}–{map.scoreB}</span></button>)}
      </div>
    </div>}
    <section className="mt-8" aria-labelledby="player-stats-title">
      <h2 id="player-stats-title" className="text-lg font-medium">Player statistics</h2>
      <p className="mt-2 text-xs text-ink-3">Swing and rating use the simulator’s own calculations.</p>
      {loadingStats ? <p role="status" className="mt-2 text-sm text-ink-2">Loading player statistics…</p> : !stats.complete && <p className="mt-2 text-sm text-ink-2">{stats.availableMaps ? `Statistics are unavailable for ${stats.totalMaps - stats.availableMaps} of ${stats.totalMaps} maps.` : "Player statistics are unavailable for this result."}</p>}
      {!loadingStats && stats.complete && !stats.metricsComplete && <p role="status" className="mt-2 text-sm text-ink-2">Detailed metrics are unavailable for this result. Saved kills and deaths are preserved.</p>}
      {(stats.teamA.length > 0 || stats.teamB.length > 0) && <div className="mt-5 grid gap-8 lg:grid-cols-2"><PlayerTable team={match.teamA} players={stats.teamA} /><PlayerTable team={match.teamB} players={stats.teamB} /></div>}
    </section>
  </main>;
}
