import test from 'node:test';
import assert from 'node:assert/strict';
import { createMapSummary, summarizeMatchPlayers, validMapPlayerStats, recoverMatchSummaryMaps } from '../src/lib/matchSummary.mjs';

const team = id => ({ id, name: id, players: Array.from({ length: 5 }, (_, i) => ({ uid: String(i), name: `${id}${i}` })) });
const match = { teamA: team('one'), teamB: team('two') };
const data = { scoreTeam1: 13, scoreTeam2: 9, winner: 'A', playerStats: ['A', 'B'].flatMap(side =>
  Array.from({ length: 5 }, (_, i) => ({ uid: `${side}:${i}`, name: 'ignored', kills: i + 1, deaths: i, assists: 2, flashAssists: 1 }))) };

test('map summary stores compact stats with distinct team-prefixed identities', () => {
  const map = createMapSummary(match, data);
  assert.equal(map.winnerId, 'one');
  assert.deepEqual(map.playerStats[0], { uid: 'A:0', kills: 1, deaths: 0, assists: 2, flashAssists: 1 });
  assert.equal(map.playerStats[5].uid, 'B:0');
  assert.ok(validMapPlayerStats(match, map));
});

test('legacy maps have no fabricated totals', () => {
  const map = createMapSummary(match, data), legacy = { map: 'de_mirage', scoreA: 13, scoreB: 9, winnerId: 'one' };
  assert.ok(validMapPlayerStats(match, legacy));
  const summary = summarizeMatchPlayers(match, [map, legacy]);
  assert.equal(summary.complete, false);
  assert.equal(summary.availableMaps, 1);
  assert.equal(summary.teamA[0].kills, null);
});

test('rejects malformed optional statistics', () => {
  const map = createMapSummary(match, data);
  for (const change of [rows => rows.pop(), rows => { rows[0].uid = rows[1].uid; }, rows => { rows[0].deaths = 23; },
    rows => { rows[0].kills = 111; }, rows => { rows[0].assists = 1.5; }, rows => { rows[0].flashAssists = 3; },
    rows => { rows[0].extra = 1; }]) {
    const rows = structuredClone(map.playerStats); change(rows);
    assert.equal(validMapPlayerStats(match, { ...map, playerStats: rows }), false);
  }
  assert.equal(validMapPlayerStats(match, { ...map, playerStats: null }), false);
});

test('aggregates BO3 maps for each team independently', () => {
  const first = createMapSummary(match, data), second = structuredClone(first), third = structuredClone(first);
  second.playerStats[0].kills = 10;
  third.playerStats[5].kills = 8;
  const result = summarizeMatchPlayers(match, [first, second, third]);
  assert.equal(result.complete, true);
  assert.equal(result.teamA[0].kills, 12);
  assert.equal(result.teamB[0].kills, 10);
  assert.equal(result.teamA[0].assists, 6);
});

test('recovery reuses matching valid cached maps and existing stats', async () => {
  const full = createMapSummary(match, data), { playerStats, ...legacy } = full;
  let loads = 0;
  const result = await recoverMatchSummaryMaps(match, [legacy, full], async () => { loads++; return data; }, [full]);
  assert.deepEqual(result, [full, full]);
  assert.equal(loads, 0);
});

test('recovery loads missing maps only when regenerated result matches', async () => {
  const full = createMapSummary(match, data), { playerStats, ...legacy } = full;
  const calls = [];
  const result = await recoverMatchSummaryMaps(match, [legacy, { ...legacy, scoreB: 8 }], async index => { calls.push(index); return data; });
  assert.deepEqual(calls, [0, 1]);
  assert.deepEqual(result, [full, { ...legacy, scoreB: 8 }]);
});

test('recovery preserves missing stats on errors and propagates abort', async () => {
  const full = createMapSummary(match, data), { playerStats, ...legacy } = full;
  assert.deepEqual(await recoverMatchSummaryMaps(match, [legacy], async () => { throw new Error('offline'); }), [legacy]);
  await assert.rejects(recoverMatchSummaryMaps(match, [legacy], async () => { throw Object.assign(new Error('cancelled'), { name: 'AbortError' }); }), { name: 'AbortError' });
});

