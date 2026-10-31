import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildWeaponAppearance, validWeaponAppearance, visibleWeapon, traceWeaponAppearances, weaponEvidenceFromRaw, validWeaponEvidence } from '../src/lib/weaponAppearance.mjs';

test('actor appearances accept independent mappings and preserve sniper classes', () => {
  const metadata = { equipment: { actors: { a: { initialInventory: ['Galil AR', 'Glock-18'] }, b: { initialInventory: ['Galil AR'] } } } };
  const state = { A: { players: [{ uid: 'x', inventory: ['AK-47', 'P250'] }] }, B: { players: [{ uid: 'y', inventory: ['M4A4'] }] } };
  const first = buildWeaponAppearance(metadata, [{ actorId: 'a', playerUid: 'x' }], state);
  assert.deepEqual(first, { a: { GALIL: 'AK47', GLOCK: 'P250' } });
  assert.deepEqual(buildWeaponAppearance(metadata, [{ actorId: 'b', playerUid: 'y' }], state, first), { ...first, b: { GALIL: 'M4A4' } });
  state.B.players[0].inventory = ['AWP'];
  assert.equal(buildWeaponAppearance(metadata, [{ actorId: 'b', playerUid: 'y' }], state), null);
  assert.equal(validWeaponAppearance({ a: { AWP: 'AK47' } }), false);
  assert.equal(validWeaponAppearance({ a: { SSG08: 'AWP' } }), false);
  assert.equal(visibleWeapon('weapon_galilar', first.a), 'AK-47');
});

test('dropped tokens transfer across sides in deterministic order and determine rewards', () => {
  const evidence = { changes: [[1,'a',['GALIL']], [1,'b',['GALIL']], [1,'c',['FAMAS']], [10,'a',[]], [10,'b',[]], [10,'c',['GALIL']], [20,'d',['GALIL']]], deaths: [[10,'a','c','famas',true], [15,'b','c','galilar',true]], pickups: [[10,'c','GALIL'], [20,'d','GALIL']] };
  const trace = traceWeaponAppearances(evidence, { a: { GALIL: 'AK47' }, b: { GALIL: 'MAC10' }, c: { FAMAS: 'M4A4' } });
  assert.equal(trace.frames.find(f => f.tick === 10).holdings.c[0].visible, 'AK47');
  assert.equal(trace.finalInventories.d[0], 'MAC-10');
  assert.equal(trace.killRewards.c, 600);
  assert.ok(trace.ambiguities > 0);
  assert.deepEqual(trace, traceWeaponAppearances(evidence, { a: { GALIL: 'AK47' }, b: { GALIL: 'MAC10' }, c: { FAMAS: 'M4A4' } }));
});

test('pickup transfers a token before the donor snapshot catches up and dead snapshots stay empty', () => {
  const evidence = { changes: [[1,'a',['GALIL']], [1,'b',['FAMAS']], [5,'b',['GALIL']], [6,'a',['GALIL']], [8,'a',[]], [10,'a',['GALIL']]], deaths: [[9,'a','b','galilar',true]], pickups: [[5,'b','GALIL'], [10,'a','GALIL']] };
  const trace = traceWeaponAppearances(evidence, { a: { GALIL: 'MAC10' }, b: { FAMAS: 'AK47' } });
  assert.equal(trace.frames.find(f => f.tick === 5).holdings.b[0].visible, 'MAC10');
  assert.deepEqual(trace.finalInventories.a, []);
  assert.equal(trace.killRewards.b, 600);
  assert.equal(trace.created, 2);
});

test('pickup alone cannot replace a sampled gun of the same original type', () => {
  const evidence = { changes: [[1,'a',['GALIL']], [1,'b',['GALIL']], [2,'a',[]]], deaths: [], pickups: [[3,'b','GALIL']] };
  const trace = traceWeaponAppearances(evidence, { a: { GALIL: 'AK47' }, b: { GALIL: 'MAC10' } });
  assert.deepEqual(trace.finalInventories.b, ['MAC-10']);
});

test('simultaneous deaths retain each attacker weapon identity', () => {
  const evidence = { changes: [[1,'a',['GALIL']], [1,'b',['GALIL']], [5,'a',['GALIL']]], deaths: [[5,'a','b','galilar',true],[5,'b','a','galilar',true]], pickups: [] };
  const trace = traceWeaponAppearances(evidence, { a: { GALIL: 'MAC10' }, b: { GALIL: 'AK47' } });
  assert.equal(trace.killRewards.a, 600);
  assert.equal(trace.killRewards.b, 300);
  assert.deepEqual(trace.finalInventories.a, []);
});


test('raw evidence compresses utility changes and credits only opposing weapon kills', () => {
  const raw = { actors: ['a', 'b'], end_tick: 20, inventory_changes: [[1,0,['AK-47']], [2,0,['AK-47','Flashbang']], [3,1,['Galil AR']]], events: [
    { tick: 4, event: 'item_pickup', steamid: 'b', item: 'ak47' },
    { tick: 5, event: 'item_pickup', steamid: 'a', item: 'c4' },
    { tick: 6, event: 'player_death', user_steamid: 'a', attacker_steamid: 'b', weapon: 'ak47' },
    { tick: 7, event: 'player_death', user_steamid: 'b', weapon: 'c4' },
  ] };
  assert.deepEqual(weaponEvidenceFromRaw(raw, { a: 'T', b: 'CT' }), {
    changes: [[1,'a',['AK47']], [3,'b',['GALIL']]], pickups: [[4,'b','AK47']],
    deaths: [[6,'a','b','ak47',true], [7,'b','','c4',false]], endTick: 20, actors: ['a','b'],
  });
});


test('evidence validation requires initial inventories and ordered valid actor events', () => {
  const evidence = { changes: [[1,'a',['AK47']], [1,'b',[]]], deaths: [], pickups: [], endTick: 10, actors: ['a','b'] };
  assert.equal(validWeaponEvidence(evidence, ['a','b'], 10), true);
  assert.equal(validWeaponEvidence({ ...evidence, changes: [[1,'a',['AK47']]] }, ['a','b'], 10), false);
  assert.equal(validWeaponEvidence({ ...evidence, pickups: [[5,'a','AK47'], [4,'b','AK47']] }, ['a','b'], 10), false);
  assert.equal(validWeaponEvidence({ ...evidence, deaths: [[3,'a','x','ak47',true]] }, ['a','b'], 10), false);
});


test('pickup hints cannot add, remove, or steal sampled inventory', () => {
  const evidence = { changes: [[1,'a',['USP']], [1,'b',['GLOCK','AK47']], [1,'c',['GLOCK','AK47']], [9,'c',['AK47','USP']]], deaths: [], pickups: [[5,'a','P2000'], [7,'b','AK47'], [9,'c','P2000']] };
  const trace = traceWeaponAppearances(evidence, {});
  assert.deepEqual(trace.finalInventories.a, ['USP-S']);
  assert.deepEqual(trace.finalInventories.b, ['Glock-18','AK-47']);
  assert.deepEqual(trace.finalInventories.c, ['AK-47','USP-S']);
});
