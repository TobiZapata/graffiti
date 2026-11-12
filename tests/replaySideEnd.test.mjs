import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeReplay, sampleReplay } from '../src/lib/roundBankReplay.mjs';
import { CURRENT_SIMULATION, assertCompatibleSimulation } from '../src/lib/simulationVersion.mjs';

function fixture(sourceRound, targetRound, freezeAtResolution = false) {
  const actors = Array.from({ length: 10 }, (_, i) => String(i + 100));
  const raw = { schema_version: 1, tick_rate: 64, sample_hz: 8, resolution_tick: 64, end_tick: 1280,
    actors, frame_columns: ['x', 'y', 'z', 'yaw', 'health', 'alive', 'active_weapon', 'defusing', 'has_kit'],
    inventory_changes: actors.map((id, i) => [1, i, ['AK-47']]),
    frames: [1, 56, 64, 72, 128, 512, 1280].map(tick => [tick, actors.map(() => [tick, 0, 0, 90, 100, true, 'AK-47', false, false])]),
    events: [64, 72].map(tick => ({ event: 'player_death', tick, user_steamid: tick === 64 ? actors[0] : actors[1], attacker_steamid: actors[5], weapon: 'ak47' })),
    grenades: [], effects: [] };
  const metadata = { round: targetRound, source_round: sourceRound, freezeAtResolution, winner_side: 'CT', win_condition: 'ELIMINATION',
    actors: actors.map((actor_id, i) => ({ actor_id, side: i < 5 ? 'T' : 'CT' })) };
  return { raw, metadata };
}

test('source side endings cap playback while ordinary rounds retain their tail', () => {
  for (const source of [12, 24, 27, 30, 33]) {
    const { raw, metadata } = fixture(source, 3);
    const round = decodeReplay(raw, metadata);
    assert.equal(round.duration, 8);
    assert.equal(sampleReplay(round, 7).players[1].alive, false);
  }
  const { raw, metadata } = fixture(3, 4);
  assert.equal(decodeReplay(raw, metadata).duration, 20);
});

test('target side ending freezes exact resolution state, retaining terminal kills and allowing seeking', () => {
  for (const source of [3, 12]) {
    const { raw, metadata } = fixture(source, 12, true);
    const original = structuredClone(raw);
    const round = decodeReplay(raw, metadata);
    const resolved = sampleReplay(round, 1), end = sampleReplay(round, 8);
    assert.equal(round.duration, 8);
    assert.deepEqual(end.players, resolved.players);
    assert.equal(end.events.length, 1);
    assert.equal(end.players[0].alive, false);
    assert.equal(end.players[1].alive, true);
    assert.equal(end.players[1].x, 64);
    assert.equal(sampleReplay(round, .5).players[0].alive, true);
    assert.deepEqual(raw, original);
  }
});

test('new bank behavior keeps saved simulation descriptors supported', () => {
  assert.equal(CURRENT_SIMULATION.bankVersion, 'mirage-economy-v2');
  assert.doesNotThrow(() => assertCompatibleSimulation({ ...CURRENT_SIMULATION, bankVersion: 'mirage-economy-v1' }));
});

test('legacy assembled map endings freeze radar state without resolution sidecar metadata', () => {
  for (const target of [12, 20, 29]) {
    const { raw, metadata } = fixture(3, target);
    metadata.macro = { overtime: target > 24 ? 1 : 0 };
    metadata.endsMatch = target !== 12;
    const round = decodeReplay(raw, metadata);
    assert.equal(round.duration, 8);
    assert.deepEqual(sampleReplay(round, 1).players, sampleReplay(round, 7).players);
    assert.equal(sampleReplay(round, 7).events.length, 1);
  }
  const { raw, metadata } = fixture(3, 20);
  metadata.macro = { overtime: 0 };
  assert.equal(decodeReplay(raw, metadata).duration, 20, 'ordinary assembled rounds keep movement');
});
