import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { calculateRoundMetrics, derivePlayerMetrics } from '../src/lib/matchMetrics.mjs';

const actors = Array.from({ length: 10 }, (_, i) => ({ actor_id: String(i), side: i < 5 ? 'T' : 'CT', survived: true }));
const death = (tick, attacker, victim, assister = '') => ({ event: 'player_death', tick, attacker_steamid: String(attacker), user_steamid: String(victim), assister_steamid: assister });
const hurt = (tick, attacker, victim, damage) => ({ event: 'player_hurt', tick, attacker_steamid: String(attacker), user_steamid: String(victim), dmg_health: damage });
const replay = events => ({ actors: actors.map(a => a.actor_id), tick_rate: 64, resolution_tick: 1000, events });

test('caps health damage, excludes friendly damage, handles kill, assist, survival and traded death', () => {
  const metadata = { actors: actors.map(a => ({ ...a, survived: !['0', '5', '6'].includes(a.actor_id) })) };
  const raw = replay([hurt(10, 0, 5, 70), hurt(11, 1, 5, 60), death(12, 1, 5, '0'),
    death(100, 6, 0), death(300, 2, 6), hurt(400, 1, 2, 40), hurt(500, 7, 2, 90)]);
  const values = calculateRoundMetrics(metadata, raw);
  assert.equal(values['0'].damage, 70);
  assert.equal(values['1'].damage, 30);
  assert.equal(values['7'].damage, 60);
  assert.equal(values['0'].kastRounds, 1);
  assert.equal(values['5'].kastRounds, 0);
  assert.equal(values['6'].kastRounds, 1);
  assert.equal(values['9'].kastRounds, 1);
  assert.equal(Object.values(values).reduce((sum, row) => sum + row.swing, 0), 0);
  assert.ok(values['1'].swing > 0 && values['5'].swing < 0);
});

test('trade applies to the dead player only within five seconds before resolution', () => {
  const metadata = { actors: actors.map(a => ({ ...a, survived: !['0', '1', '5', '6'].includes(a.actor_id) })) };
  const stats = calculateRoundMetrics(metadata, replay([death(10, 5, 0), death(331, 1, 5), death(400, 6, 1), death(1001, 2, 6)]));
  assert.equal(stats['0'].kastRounds, 0);
  assert.equal(stats['1'].kastRounds, 1); // made a kill, post-resolution trade is excluded
  assert.equal(stats['6'].swing > 0, true);
  assert.equal(stats['2'].swing, 0);
  const traded = calculateRoundMetrics(metadata, replay([death(10, 5, 0), death(330, 2, 5)]));
  assert.equal(traded['0'].kastRounds, 1);
});

test('derives per-round totals and handles unavailable or zero-round inputs', () => {
  const result = derivePlayerMetrics({ kills: 20, deaths: 15, assists: 5, damage: 2000, kastRounds: 18, swing: 5000 }, 25);
  assert.equal(result.adr, 80);
  assert.equal(result.kast, 72);
  assert.equal(result.swing, 2);
  assert.ok(result.rating > 1);
  assert.equal(derivePlayerMetrics({}, 25).rating, null);
  assert.equal(derivePlayerMetrics({}, 0).rating, null);
});

test('excludes self, team and bomb damage while preserving lethal hurt after death in the same tick', () => {
  const metadata = { actors };
  const bomb = { ...hurt(6, 5, 0, 100), weapon: 'planted_c4' };
  const values = calculateRoundMetrics(metadata, replay([hurt(1, 0, 0, 10), hurt(2, 1, 0, 20), hurt(3, 5, 0, 30),
    death(4, 5, 0), hurt(4, 5, 0, 100), bomb]));
  assert.equal(values['5'].damage, 70);
  assert.equal(values['0'].damage, 0);
  assert.equal(values['1'].damage, 0);
});

test('counts a dead attacker grenade and same-tick trade without resurrecting victims', () => {
  const metadata = { actors: actors.map(a => ({ ...a, survived: !['0', '5', '6'].includes(a.actor_id) })) };
  const values = calculateRoundMetrics(metadata, replay([death(1, 5, 0), death(1, 1, 5), death(2, 5, 1), death(3, 5, 6)]));
  assert.equal(values['0'].kastRounds, 1);
  assert.ok(values['1'].swing < 0); // killed by an attacker who was already dead
  assert.equal(Object.values(values).reduce((sum, row) => sum + row.swing, 0), 0);
  const oneKill = calculateRoundMetrics(metadata, replay([death(1, 5, 0)]));
  assert.equal(oneKill['5'].swing, 1098);
  assert.equal(oneKill['0'].swing, -1098);
});

test('rejects unordered events and duplicate source actors', () => {
  assert.throws(() => calculateRoundMetrics({ actors }, replay([death(5, 0, 5), death(4, 1, 6)])), /event/);
  const raw = replay([]); raw.actors[0] = raw.actors[1];
  assert.throws(() => calculateRoundMetrics({ actors }, raw), /input/);
});

test('calculates bounded statistics from a real source replay', () => {
  const index = JSON.parse(readFileSync('public/round-bank/economy-index.json'));
  const metadata = index.rounds.find(row => row.eligible && row.equipment?.supported);
  const raw = JSON.parse(gunzipSync(readFileSync(`public${metadata.replay_data_ref}`)));
  const stats = calculateRoundMetrics(metadata, raw);
  assert.equal(Object.keys(stats).length, 10);
  assert.ok(Object.values(stats).some(row => row.damage > 0));
  assert.ok(Object.values(stats).every(row => Number.isInteger(row.damage) && row.damage >= 0 && row.damage <= 500 && [0, 1].includes(row.kastRounds)));
  assert.equal(Object.values(stats).reduce((sum, row) => sum + row.swing, 0), 0);
});
