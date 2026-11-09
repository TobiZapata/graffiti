import { readFile, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { assembleMirageBO1 } from '../src/lib/assembleMirageBO1.mjs';
import { prepareReplayTeam } from '../src/lib/replayTeam.mjs';
import { attachReplayMetrics } from '../src/lib/replayMetrics.mjs';
import { createMapSummary, summarizeMatchPlayers } from '../src/lib/matchSummary.mjs';

const bank = JSON.parse(await readFile('public/round-bank/economy-index.json', 'utf8'));
const metrics = JSON.parse(gunzipSync(await readFile('public/round-metrics-v1.json.gz')));
const teams = JSON.parse(await readFile('src/data/teams.json', 'utf8'));
const reference = JSON.parse(await readFile('docs/fixtures/hltv-metrics-reference.json', 'utf8'));
const simulated = [], samples = [];
for (let i = 0; i < 40; i++) {
  const match = { teamA: teams[i % teams.length], teamB: teams[(i + 7) % teams.length] };
  const seed = `metrics-calibration-v1:${i}`;
  const data = attachReplayMetrics(assembleMirageBO1(bank, prepareReplayTeam(match.teamA), prepareReplayTeam(match.teamB), seed), metrics);
  const map = createMapSummary(match, data), summary = summarizeMatchPlayers(match, [map]);
  const rows = [...summary.teamA, ...summary.teamB];
  simulated.push(...rows);
  if (i < 3) samples.push({ seed, teamA: match.teamA.name, teamB: match.teamB.name, score: [map.scoreA, map.scoreB], players: rows });
}
const real = reference.maps.flatMap(map => map.players.map(row => Object.fromEntries(reference.columns.map((key, i) => [key, row[i]]))));
function describe(rows) {
  return Object.fromEntries(['adr', 'kast', 'swing', 'rating'].map(field => {
    const values = rows.map(p => p[field]).filter(Number.isFinite).sort((a, b) => a - b);
    const round = n => Math.round(n * 1000) / 1000;
    return [field, { n: values.length, mean: round(values.reduce((a, b) => a + b, 0) / values.length),
      min: round(values[0]), p10: round(values[Math.floor((values.length - 1) * .1)]),
      median: round(values[Math.floor((values.length - 1) * .5)]), p90: round(values[Math.floor((values.length - 1) * .9)]), max: round(values.at(-1)) }];
  }));
}
const report = { maps: 40, simulated: describe(simulated), hltvReference: describe(real), sources: reference.maps.map(m => m.source), samples,
  limits: 'Different maps and eras; only 20 real rows, mixing Rating 2.0 and 3.0. This checks plausible magnitude and spread, not accuracy against HLTV or identical-match reconstruction.' };
await writeFile('docs/fixtures/match-metrics-calibration.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ simulated: report.simulated, hltvReference: report.hltvReference }, null, 2));
