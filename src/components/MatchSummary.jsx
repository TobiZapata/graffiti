"use client";

import { useState } from "react";
import Link from "next/link";
import TeamMark from "./major/TeamMark";
import TeamName from "./major/TeamName";
import { replayBestOf } from "@/lib/replaySeries.mjs";
import { summarizeMatchPlayers } from "@/lib/matchSummary.mjs";

const mapName = (map) => (map?.map || "Unknown map").replace(/^de_/, "").replace(/^./, c => c.toUpperCase());
const value = (n) => n == null ? "—" : n;

function PlayerTable({ team, players }) {
  return <section className="min-w-0" aria-label={`${team.name} player statistics`}>
    <div className="flex items-center gap-2 border-b border-rule-strong pb-3">
      <TeamMark team={team} size={24} /><TeamName team={team} className="font-medium" />
    </div>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[320px] text-sm">
        <thead className="text-xs text-ink-3"><tr>
          <th scope="col" className="py-3 pr-4 text-left font-normal">Player</th>
          <th scope="col" className="px-2 text-right font-normal" title="Kills">K</th>
          <th scope="col" className="px-2 text-right font-normal" title="Deaths">D</th>
          <th scope="col" className="px-2 text-right font-normal" title="Assists">A</th>
          <th scope="col" className="pl-2 text-right font-normal" aria-label="Flash assists"><abbr title="Flash assists" className="no-underline">FA</abbr></th>
        </tr></thead>
        <tbody>{players.map(player => <tr key={player.uid} className="border-t border-rule">
          <th scope="row" className="py-3 pr-4 text-left font-normal">{player.name}</th>
          {[player.kills, player.deaths, player.assists, player.flashAssists].map((stat, i) => <td key={i} className="tabular px-2 text-right last:pr-0">{value(stat)}</td>)}
        </tr>)}</tbody>
        <tfoot><tr className="border-t border-rule-strong font-medium">
          <th scope="row" className="py-3 pr-4 text-left">Team total</th>
          {['kills', 'deaths', 'assists', 'flashAssists'].map(field => <td key={field} className="tabular px-2 text-right last:pr-0">{players.some(player => player[field] == null) ? '—' : players.reduce((sum, player) => sum + player[field], 0)}</td>)}
        </tr></tfoot>
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
      {loadingStats ? <p role="status" className="mt-2 text-sm text-ink-2">Loading player statistics…</p> : !stats.complete && <p className="mt-2 text-sm text-ink-2">{stats.availableMaps ? `Statistics are unavailable for ${stats.totalMaps - stats.availableMaps} of ${stats.totalMaps} maps.` : "Player statistics are unavailable for this result."}</p>}
      {(stats.teamA.length > 0 || stats.teamB.length > 0) && <div className="mt-5 grid gap-8 lg:grid-cols-2"><PlayerTable team={match.teamA} players={stats.teamA} /><PlayerTable team={match.teamB} players={stats.teamB} /></div>}
    </section>
  </main>;
}
