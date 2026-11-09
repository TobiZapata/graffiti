import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { assembleMirageBO1 } from '../src/lib/assembleMirageBO1.mjs';
import { prepareReplayTeam } from '../src/lib/replayTeam.mjs';
import { attachReplayMetrics } from '../src/lib/replayMetrics.mjs';
import { createMapSummary, hasMapMetrics, summarizeMatchPlayers, validMapPlayerStats, recoverMatchSummaryMaps } from '../src/lib/matchSummary.mjs';

const bank = JSON.parse(readFileSync('public/round-bank/economy-index.json'));
const metrics = JSON.parse(gunzipSync(readFileSync('public/round-metrics-v1.json.gz')));
const teams = JSON.parse(readFileSync('src/data/teams.json'));
const match = { teamA: teams[0], teamB: teams[1] };
const data = assembleMirageBO1(bank, prepareReplayTeam(match.teamA), prepareReplayTeam(match.teamB), 'metrics-integration');

test('compact sidecar covers every supported round and matches bank provenance', () => {
  const supported = bank.rounds.filter(r => r.eligible && r.equipment?.supported);
  assert.equal(Object.keys(metrics.rounds).length, supported.length);
  for (const round of supported) {
    const entry = metrics.rounds[round.round_id];
    assert.equal(entry.sha256, round.replay_sha256);
    assert.deepEqual(Object.keys(entry.actors).sort(), round.actors.map(a => a.actor_id).sort());
    assert.ok(Object.values(entry.actors).every(row => row.length === 3 && row.every(Number.isSafeInteger) && row[0] >= 0 && row[0] <= 500 && [0, 1].includes(row[1]) && Math.abs(row[2]) <= 50000));
    assert.equal(Object.values(entry.actors).reduce((sum, row) => sum + row[2], 0), 0);
  }
});

test('real assigned actions produce saved metrics without changing simulation or legacy KDA', () => {
  const enriched = attachReplayMetrics(data, metrics), map = createMapSummary(match, enriched);
  assert.ok(hasMapMetrics(map));
  assert.ok(validMapPlayerStats(match, map));
  assert.deepEqual(data.playerStats.map(p => [p.uid, p.kills, p.deaths, p.assists]), enriched.playerStats.map(p => [p.uid, p.kills, p.deaths, p.assists]));
  assert.equal(enriched.catalog, data.catalog);
  assert.equal(map.playerStats.reduce((sum, p) => sum + p.swingTotal, 0), 0);
  const summary = summarizeMatchPlayers(match, [map]);
  assert.ok([...summary.teamA, ...summary.teamB].every(p => p.adr >= 0 && p.adr <= 500 && p.kast >= 0 && p.kast <= 100 && p.rating >= 0));
  const first = data.catalog.rounds[0], broken = structuredClone(metrics);
  broken.rounds[first.round_id].sha256 = 'stale';
  assert.throws(() => attachReplayMetrics(data, broken), /match/);
  broken.rounds[first.round_id] = metrics.rounds[first.round_id];
  broken.rounds[first.round_id] = structuredClone(broken.rounds[first.round_id]);
  broken.rounds[first.round_id].actors[first.assignments[0].actorId][0] = -1;
  assert.throws(() => attachReplayMetrics(data, broken), /Invalid/);
});

test('series recomputes ratios by rounds and missing metrics never become fabricated zeros', async () => {
  const first = createMapSummary(match, attachReplayMetrics(data, metrics));
  const second = structuredClone(first);
  second.scoreA += 3;
  const summary = summarizeMatchPlayers(match, [first, second]);
  const p = summary.teamA[0], total = first.scoreA + first.scoreB + second.scoreA + second.scoreB;
  assert.equal(p.adr, 2 * first.playerStats[0].damage / total);
  assert.equal(p.kast, 2 * first.playerStats[0].kastRounds / total * 100);
  assert.equal(p.swing, 2 * first.playerStats[0].swingTotal / 100 / total);
  const old = createMapSummary(match, data);
  const partial = summarizeMatchPlayers(match, [first, old]);
  assert.equal(partial.teamA[0].rating, null);
  assert.equal(partial.teamA[0].kills, first.playerStats[0].kills * 2);
  assert.ok(validMapPlayerStats(match, old));
  assert.deepEqual(await recoverMatchSummaryMaps(match, [old], async () => attachReplayMetrics(data, metrics), [], true), [first]);
  const corrupted = structuredClone(first);
  corrupted.playerStats[0].kastRounds = first.scoreA + first.scoreB + 1;
  assert.equal(validMapPlayerStats(match, corrupted), false);
  corrupted.playerStats[0].kastRounds = 0;
  delete corrupted.playerStats[0].damage;
  assert.equal(validMapPlayerStats(match, corrupted), false);
});

test('metrics recovery preserves saved KDA even when a different assembly has the same score', async () => {
  const generated = attachReplayMetrics(data, metrics), full = createMapSummary(match, generated);
  const old = createMapSummary(match, data);
  old.playerStats[0].kills += 1;
  assert.ok(validMapPlayerStats(match, old));
  assert.deepEqual(await recoverMatchSummaryMaps(match, [old], async () => generated, [full], true), [old]);
});
