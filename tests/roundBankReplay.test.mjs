import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { decodeReplay, sampleReplay, worldToRadar } from '../src/lib/roundBankReplay.mjs';

function fixture() {
  const actors = Array.from({ length: 10 }, (_, i) => String(100 + i));
  const metadata = { round: 3, winner_side: 'CT', win_condition: 'DEFUSE', actors: actors.map((id, i) => ({ actor_id: id, side: i < 5 ? 'T' : 'CT' })) };
  const raw = { schema_version: 1, tick_rate: 64, sample_hz: 8, start_tick: 1000, resolution_tick: 60, end_tick: 64,
    actors, frame_columns: ['x', 'y', 'z', 'yaw', 'health', 'alive', 'active_weapon', 'defusing', 'has_kit'],
    inventory_changes: actors.map((id, i) => [1, i, [i === 2 ? 'SSG 08' : 'AK-47', ...(i === 0 ? ['C4 Explosive'] : [])]]),
    frames: [1, 9, 17, 25, 33, 41, 49, 57, 64].map(tick => [tick, actors.map((id, i) => [tick, i, 0, 359, i === 0 && tick >= 25 ? 0 : 100,
      !(i === 0 && tick >= 25), i === 2 ? 'SSG 08' : i === 1 && tick >= 25 ? 'AWP' : 'AK-47', i === 5 && [9, 25, 33, 41, 49, 57].includes(tick), i === 5])]),
    events: [], grenades: [], effects: [] };
  raw.inventory_changes.push([25, 1, ['AWP']]);
  return { raw, metadata };
}

test('global weapon appearances follow pickups and events without changing evidence', () => {
  const { raw, metadata } = fixture();
  metadata.weaponAppearance = { '100': { GALIL: 'AK47' }, '105': { FAMAS: 'M4A1S' } };
  raw.inventory_changes[0][2] = ['Galil AR', 'C4 Explosive'];
  raw.inventory_changes[5][2] = ['FAMAS'];
  raw.inventory_changes.push([25, 0, []], [25, 5, ['Galil AR']]);
  for (const [tick, rows] of raw.frames) {
    rows[0][6] = 'Galil AR';
    rows[5][6] = tick < 25 ? 'FAMAS' : 'Galil AR';
  }
  raw.events = [{ tick: 30, event: 'weapon_fire', steamid: '105', weapon: 'galilar' }, { tick: 31, event: 'player_death', user_steamid: '100', attacker_steamid: '105', weapon: 'galilar' }];
  const original = structuredClone(raw), round = decodeReplay(raw, metadata);
  assert.equal(round.frames[0].players[0].weapon, 'AK-47');
  assert.equal(sampleReplay(round, .1).players[5].weapon, 'M4A1-S');
  assert.equal(sampleReplay(round, .5).players[5].weapon, 'AK-47');
  assert.equal(round.frames.at(-1).players[5].inventory[0], 'AK-47');
  assert.equal(sampleReplay(round, 1).events[1].weapon, 'AK-47');
  assert.equal(sampleReplay(round, 1).events[1].rawWeapon, 'galilar');
  assert.deepEqual(sampleReplay(round, .4), sampleReplay(round, .4));
  assert.deepEqual(raw, original);
  metadata.weaponAppearance = { '100': { AK47: 'AWP' } };
  assert.throws(() => decodeReplay(raw, metadata), /apariencia/);
});

test('decodes relative ticks, explicit sides, names and original Scout/AWP identities', () => {
  const { raw, metadata } = fixture();
  const round = decodeReplay(raw, metadata, { 100: 'Jugador' });
  assert.equal(round.frames[0].t, 1 / 64);
  assert.equal(round.duration, 1);
  assert.equal(round.players[0].name, 'Jugador');
  assert.equal(round.players[5].side, 'CT');
  assert.equal(sampleReplay(round, 25 / 64).players[1].weapon, 'AWP');
  assert.deepEqual(sampleReplay(round, 25 / 64).players[1].inventory, ['AWP']);
  assert.equal(sampleReplay(round, .8).players[2].weapon, 'SSG 08');
  assert.equal(sampleReplay(round, .1).players[1].weapon, 'AK-47');
  assert.deepEqual(worldToRadar({ x: -3230, y: 1713 }, { originX: -3230, originY: 1713, scale: 5 }), { x: 0, y: 0 });
});

test('death uses exact event tick before the sampled alive flag updates; seeking resets', () => {
  const { raw, metadata } = fixture();
  raw.events = [{ tick: 20, event: 'player_death', steamid: '100', user_steamid: '100', attacker_steamid: '105',
    assister_steamid: '106', assistedflash: true, headshot: true, penetrated: 1, thrusmoke: true, x: 22, y: 3, z: 0 }];
  const round = decodeReplay(raw, metadata);
  const state = sampleReplay(round, 20 / 64);
  assert.equal(state.players[0].alive, false);
  assert.equal(state.players[0].health, 0);
  assert.equal(state.players[0].x, 22);
  assert.equal(state.events[0].attacker, '105');
  assert.equal(state.events[0].assistedflash, true);
  assert.equal(state.events[0].thrusmoke, true);
  assert.equal(sampleReplay(round, 19 / 64).players[0].alive, true);
  assert.equal(sampleReplay(round, 1).result.winnerSide, 'CT');
});

test('initial bomb carrier is read from inventory without inventing pickup events', () => {
  const { raw, metadata } = fixture();
  const state = sampleReplay(decodeReplay(raw, metadata), 0);
  assert.equal(state.bomb.status, 'carried');
  assert.equal(state.bomb.carrier, '100');
  assert.equal(state.events.length, 0);
});

test('explosion and defuse retain the plant position despite terminal actor coordinates', () => {
  for (const terminal of ['bomb_exploded', 'bomb_defused']) {
    const { raw, metadata } = fixture();
    raw.events = [
      { tick: 5, event: 'bomb_planted', steamid: '100', x: 5, y: 6, z: 7 },
      { tick: 50, event: terminal, steamid: '105', x: 900, y: 800, z: 700 },
    ];
    const original = structuredClone(raw);
    const round = decodeReplay(raw, metadata);
    const before = sampleReplay(round, 49 / 64).bomb;
    const after = sampleReplay(round, 1).bomb;
    assert.equal(after.status, terminal.slice(5));
    assert.deepEqual([after.x, after.y, after.z], [before.x, before.y, before.z]);
    assert.equal(sampleReplay(round, 49 / 64).bomb.status, 'planted');
    assert.deepEqual(raw, original);
  }
});

test('credited assists require another teammate of the attacker while preserving native fields', () => {
  for (const [assister, credited] of [['100', null], ['105', null], ['999', null], ['106', '106']]) {
    const { raw, metadata } = fixture();
    raw.events = [{ tick: 20, event: 'player_death', user_steamid: '100', attacker_steamid: '105',
      assister_steamid: assister, assistedflash: true }];
    const event = sampleReplay(decodeReplay(raw, metadata), 1).events[0];
    assert.equal(event.assister, credited);
    assert.equal(event.assister_steamid, assister);
    assert.equal(raw.events[0].assister, undefined);
  }
});

test('sampled defuse progress stops on abort and restarts from the next observed attempt', () => {
  const { raw, metadata } = fixture();
  raw.events = [{ tick: 5, event: 'bomb_planted', steamid: '100', x: 5, y: 5, z: 0 }];
  const round = decodeReplay(raw, metadata);
  assert.equal(sampleReplay(round, 16 / 64).players[5].defuse.duration, 5);
  assert.equal(sampleReplay(round, 17 / 64).players[5].defuse, null);
  const attempt = sampleReplay(round, 32 / 64).players[5].defuse;
  assert.equal(attempt.startedAt, 25 / 64);
  assert.equal(attempt.progress, 7 / 64 / 5);
  assert.equal(attempt.evidence, 'sampled_flag');
  assert.equal(sampleReplay(round, 1).players[5].defuse, null);
  raw.frames.forEach(([, rows]) => { rows[5][8] = false; });
  assert.equal(sampleReplay(decodeReplay(raw, metadata), .5).players[5].defuse.duration, 10);
});

test('malformed roster, frame state, ordering, inventory and numeric identities are rejected', () => {
  const mutations = [
    raw => { raw.actors[1] = raw.actors[0]; },
    raw => { raw.frames[0][1][0][0] = NaN; },
    raw => { raw.frames[1][0] = 1; },
    raw => { raw.frames[0][1].pop(); },
    raw => { raw.inventory_changes.shift(); },
    raw => { raw.events = [{ tick: 1, event: 'player_death', steamid: 100 }]; },
    raw => { raw.events = [{ tick: 65, event: 'bomb_exploded', steamid: 'unknown' }]; },
  ];
  for (const mutate of mutations) {
    const { raw, metadata } = fixture();
    mutate(raw);
    assert.throws(() => decodeReplay(raw, metadata), /Replay inválido/);
  }
  const { raw, metadata } = fixture();
  metadata.actors[0].side = 'CT';
  assert.throws(() => decodeReplay(raw, metadata), /cinco actores/);
});

const bankRoot = new URL('../../cs2-data-lab/output/round-bank/', import.meta.url);
test('a real eligible bank round decodes and its final observed kills match metadata',
  { skip: !existsSync(new URL('catalog.json', bankRoot)) }, () => {
  const root = bankRoot;
  const catalog = JSON.parse(readFileSync(new URL('catalog.json', root), 'utf8'));
  const metadata = catalog.rounds.find(round => round.eligible && round.win_condition === 'DEFUSE');
  const raw = JSON.parse(readFileSync(new URL(metadata.replay_data_ref, root), 'utf8'));
  const round = decodeReplay(raw, metadata);
  const state = sampleReplay(round, round.duration);
  assert.equal(state.players.length, 10);
  for (const actor of metadata.actors) {
    assert.equal(state.players.find(p => p.id === actor.actor_id).alive, actor.survived);
    const kills = state.events.filter(event => event.type === 'player_death' && event.attacker === actor.actor_id &&
      round.sides[event.victim] !== actor.side && !['c4', 'planted_c4'].includes(event.weapon)).length;
    assert.equal(kills, actor.kills);
  }
});

test('all shipped fixtures preserve real kills, assists, survival, snipers and sampled defuse', () => {
  const index = JSON.parse(readFileSync(new URL('../public/round-bank-lab/index.json', import.meta.url), 'utf8'));
  assert.equal(index.rounds.length, 3);
  let sawAwp = false, sawScout = false, sawDefuse = false;
  for (const metadata of index.rounds) {
    const raw = JSON.parse(readFileSync(new URL(`../public${metadata.replay_data_ref}`, import.meta.url), 'utf8'));
    const round = decodeReplay(raw, metadata, index.names);
    const state = sampleReplay(round, round.duration);
    const validKills = state.events.filter(event => event.type === 'player_death' && round.sides[event.attacker] &&
      round.sides[event.victim] !== round.sides[event.attacker] && !['c4', 'planted_c4'].includes(event.weapon));
    for (const actor of metadata.actors) {
      const player = state.players.find(p => p.id === actor.actor_id);
      assert.equal(player.alive, actor.survived, `${metadata.round_id}: survival of ${actor.actor_id}`);
      assert.equal(validKills.filter(e => e.attacker === actor.actor_id).length, actor.kills);
      const assists = validKills.filter(e => e.assister === actor.actor_id);
      assert.equal(assists.length, actor.assists);
      assert.equal(assists.filter(e => e.assistedflash).length, actor.flash_assists);
      if (actor.survived) assert.ok(player.inventory.includes(actor.final_weapon));
    }
    sawAwp ||= round.frames.some(frame => frame.players.some(p => p.weapon === 'AWP' && p.inventory.includes('AWP')));
    sawScout ||= round.frames.some(frame => frame.players.some(p => p.weapon === 'SSG 08' && p.inventory.includes('SSG 08')));
    if (metadata.win_condition === 'DEFUSE') {
      const attempts = round.frames.filter(frame => frame.players.some(p => p.defusing));
      sawDefuse = attempts.some(frame => sampleReplay(round, frame.t).players.some(p => p.defuse?.evidence === 'sampled_flag'));
    }
  }
  assert.ok(sawAwp, 'AWP remains an AWP');
  assert.ok(sawScout, 'Scout remains an SSG 08');
  assert.ok(sawDefuse, 'DEFUSE fixture exposes sampled defuse progress');
});

test('rejects malformed supplied weapon evidence before decoding', () => {
  const { raw, metadata } = fixture();
  metadata.weaponAppearance = {};
  for (const evidence of [
    { changes: [[1, 'missing', ['AK47']]], deaths: [], pickups: [] },
    { changes: [], deaths: [], pickups: [[1, '100', 'HE']] },
    { changes: [], deaths: [[1, '100', '105', 'ak47', 1]], pickups: [] },
  ]) {
    metadata.equipment = { weaponEvidence: evidence };
    assert.throws(() => decodeReplay(raw, metadata), /evidencia de armas/);
  }
});
