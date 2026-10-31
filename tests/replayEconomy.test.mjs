import test from 'node:test';
import assert from 'node:assert/strict';
import { inventoryItem, normalizeInventory, createReplayEconomy, beginReplayRound, finishReplayRound } from '../src/lib/replayEconomy.mjs';
const roster = () => ({ players: Array.from({length: 5}, (_, i) => ({ uid: String(i) })) });
const state = () => createReplayEconomy(roster(), roster());
const rows = prefix => Array.from({length: 5}, (_, i) => ({ actorId: `${prefix}${i}`, playerUid: `${prefix}:${i}` }));
test('aliases, known prices and unsupported inventories', () => {
  assert.equal(inventoryItem('weapon_m4a1_silencer').cost, 2900);
  assert.equal(inventoryItem('hegrenade').cost, 300);
  assert.equal(inventoryItem('High Explosive Grenade').cost, 300);
  assert.equal(inventoryItem('P2000').cost, 150);
  assert.deepEqual(normalizeInventory(['weapon_ak47', 'M9 Bayonet', 'C4Explosive']), ['AK-47']);
  assert.equal(normalizeInventory(['AUG']), null);
});
test('round resets money at half and overtime', () => {
  const before = state();
  before.A.players[0].armor = 100; before.A.players[0].hasHelmet = true; before.A.players[0].utilityStock = 500;
  before.A.recentWins = [true, true]; before.A.lastResult = true; before.A.previousPlanted = true;
  const reset = beginReplayRound(before, {round: 28}); assert.equal(reset.A.players[0].money, 10000);
  assert.equal(reset.A.players[0].armor, 0); assert.equal(reset.A.players[0].hasHelmet, false); assert.equal(reset.A.players[0].utilityStock, 0);
  assert.deepEqual(reset.A.recentWins, []); assert.equal(reset.A.lastResult, null); assert.equal(reset.A.previousPlanted, false);
  assert.equal(beginReplayRound(reset, {round: 13}).A.players[0].money, 800);
});
test('final survival, rewards and money cap', () => {
  const s = state(); s.A.players[0].money = 15900;
  s.A.players[0].armor = 100; s.A.players[0].hasHelmet = true;
  s.A.players[1].armor = 100; s.A.players[1].hasHelmet = true; s.A.players[1].hasKit = true;
  const assignments = [...rows('A'), ...rows('B')];
  const actors = assignments.map((a, i) => ({actor_id: a.actorId, side: i < 5 ? 'T' : 'CT', survived: i !== 0}));
  const e = Object.fromEntries(assignments.map(a => [a.actorId, {finalInventory: ['AWP'], finalHasKit: true}]));
  const metadata = {actors, equipment: {actors: e, killRewards: {A0: 100}, planters: ['A0'], ctKills: 2}};
  const before = structuredClone(s), result = finishReplayRound(s, metadata, assignments, {teamASide:'T', winnerSide:'T'});
  assert.equal(result.A.players[0].money, 16000); assert.deepEqual(result.A.players[0].inventory, []); assert.equal(result.A.players[0].hasKit, false);
  assert.deepEqual(result.A.players[1].inventory, ['AWP']); assert.equal(result.B.players[0].money, 2800); assert.deepEqual(s, before);
  assert.equal(result.A.players[0].armor, 0); assert.equal(result.A.players[0].hasHelmet, false);
  assert.equal(result.A.players[1].armor, 100); assert.equal(result.A.players[1].hasHelmet, true); assert.equal(result.A.players[1].hasKit, true);
  assert.deepEqual(result.A.recentWins, [true]); assert.deepEqual(result.B.recentWins, [false]); assert.equal(result.A.previousPlanted, true);
});
