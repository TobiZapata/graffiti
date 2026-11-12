import test from 'node:test';
import assert from 'node:assert/strict';
import { attachRoundResolutions, isSideEndRound, resolutionRound } from '../src/lib/replayResolution.mjs';

const actors = Array.from({ length: 10 }, (_, i) => ({ actor_id: String(i), side: i < 5 ? 'T' : 'CT', survived: true, kills: 0, deaths: 0, assists: 0, flash_assists: 0 }));
const source = { round_id: 'r', eligible: true, replay_sha256: 'hash', actors, equipment: { supported: true } };
const entry = { sha256: 'hash', actors, equipment: { supported: true }, metrics: Object.fromEntries(actors.map(a => [a.actor_id, [0, 1, 0]])) };

test('resolution data is checked and applied only at side ends', () => {
  const catalog = attachRoundResolutions({ rounds: [source] }, { version: 1, rounds: { r: entry } });
  for (const n of [12, 24, 27, 30, 33]) assert.equal(isSideEndRound(n), true);
  for (const n of [1, 13, 25, 26, 28]) assert.equal(isSideEndRound(n), false);
  assert.equal(resolutionRound(catalog.rounds[0], 12).freezeAtResolution, true);
  assert.equal(resolutionRound(catalog.rounds[0], 11), catalog.rounds[0]);
  assert.equal(resolutionRound(catalog.rounds[0], 20, true).freezeAtResolution, true);
  assert.equal(resolutionRound(source, 12), source);
  assert.throws(() => attachRoundResolutions({ rounds: [source] }, { version: 1, rounds: { r: { ...entry, sha256: 'wrong' } } }));
  assert.throws(() => attachRoundResolutions({ rounds: [source] }, { version: 1, rounds: {} }));
});
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { assembleMirageBO1 } from '../src/lib/assembleMirageBO1.mjs';
import { decodeReplay, sampleReplay } from '../src/lib/roundBankReplay.mjs';
import { attachReplayMetrics } from '../src/lib/replayMetrics.mjs';

const readGzip = path => JSON.parse(gunzipSync(readFileSync(path)));
test('real assembled half endings retain consistent replay and totals', () => {
  const base = JSON.parse(readFileSync('public/round-bank/economy-index.json'));
  const catalog = attachRoundResolutions(base, readGzip('public/round-resolution-v1.json.gz'));
  const metrics = readGzip('public/round-metrics-v1.json.gz');
  const team = name => ({ id: name, name, mainAwperUid: '4', players: Array.from({ length: 5 }, (_, i) => ({ name: `${name}${i}`, uid: String(i), rating: 80 + i, role: i ? 'RIFLER' : 'AWPER' })) });
  const match = assembleMirageBO1(catalog, team('A'), team('B'), 'resolution-real', 'resolution-real', 2);
  const enriched = attachReplayMetrics(match, metrics);
  for (const info of match.catalog.rounds) {
    assert.equal(info.endsMatch, info === match.catalog.rounds.at(-1));
    assert.equal(!!info.freezeAtResolution, isSideEndRound(info.round) || info === match.catalog.rounds.at(-1));
    if (!info.freezeAtResolution) continue;
    const raw = readGzip(`public${info.replay_data_ref}`), round = decodeReplay(raw, info), state = sampleReplay(round, round.duration);
    assert.equal(round.duration, round.result.t + 7);
    assert.deepEqual(state.players, sampleReplay(round, round.result.t).players);
    assert.ok(state.events.every(event => event.t <= round.result.t));
    for (const actor of info.actors) {
      const deaths = state.events.filter(e => e.type === 'player_death');
      const kills = deaths.filter(e => round.sides[e.attacker] && round.sides[e.victim] && round.sides[e.attacker] !== round.sides[e.victim] && !['c4', 'planted_c4'].includes(e.rawWeapon ?? e.weapon));
      assert.equal(state.players.find(p => p.id === actor.actor_id).alive, actor.survived);
      assert.equal(kills.filter(e => e.attacker === actor.actor_id).length, actor.kills);
      assert.equal(deaths.filter(e => e.victim === actor.actor_id).length, actor.deaths);
      assert.equal(kills.filter(e => e.assister === actor.actor_id).length, actor.assists);
      assert.equal(kills.filter(e => e.assister === actor.actor_id && e.assistedflash).length, actor.flash_assists);
    }
  }
  for (const p of enriched.playerStats) {
    const assigned = match.catalog.rounds.map(r => [r, r.assignments.find(a => a.playerUid === p.uid).actorId]);
    for (const [stat, field] of [['kills','kills'], ['deaths','deaths'], ['assists','assists'], ['flashAssists','flash_assists']])
      assert.equal(p[stat], assigned.reduce((sum, [r, id]) => sum + r.actors.find(a => a.actor_id === id)[field], 0));
    for (const [stat, column] of [['damage',0], ['kastRounds',1], ['swingTotal',2]])
      assert.equal(p[stat], assigned.reduce((sum, [r, id]) => sum + (r.freezeAtResolution ? r.resolution.metrics : metrics.rounds[r.round_id].actors)[id][column], 0));
  }
});
