import test from 'node:test';
import assert from 'node:assert/strict';
import { replayRoundTimer } from '../src/lib/replayRoundTimer.mjs';

const round = { result: { t: 150 } };
const plant = { type: 'bomb_planted', t: 100 };
const at = (time, events = [], source = round) => replayRoundTimer(source, {
  time, events: events.filter(event => event.t <= time),
});

test('counts playable round time, clamps at zero and freezes at round end', () => {
  assert.equal(at(0).label, '1:55');
  assert.equal(at(.5).label, '1:55');
  assert.equal(at(55).label, '1:00');
  assert.equal(at(114.5).label, '0:01');
  assert.equal(at(116).label, '0:00');
  assert.equal(at(90, [], { result: { t: 60 } }).label, '0:55');
});

test('fills over forty seconds from plant, independent of round duration', () => {
  assert.deepEqual(at(100, [plant]), { status: 'planted', progress: 0 });
  assert.deepEqual(at(120, [plant]), { status: 'planted', progress: .5 });
  assert.deepEqual(at(139, [plant]), { status: 'planted', progress: .975 });
  // A full fill alone must not invent an explosion event.
  assert.deepEqual(at(145, [plant]), { status: 'planted', progress: 1 });
});

test('only confirmed defuse turns green; seeking restores the earlier state', () => {
  const events = [plant, { type: 'bomb_begindefuse', t: 110 },
    { type: 'bomb_abortdefuse', t: 112 }, { type: 'bomb_defused', t: 125 }];
  assert.deepEqual(at(120, events), { status: 'planted', progress: .5 });
  assert.deepEqual(at(130, events), { status: 'defused', progress: .625 });
  assert.deepEqual(at(120, events), { status: 'planted', progress: .5 });
  assert.equal(at(99, events).status, 'round');
});

test('explosion leaves a full red icon and repeated samples do not advance it', () => {
  const events = [plant, { type: 'bomb_exploded', t: 140 }];
  assert.deepEqual(at(145, events), { status: 'exploded', progress: 1 });
  assert.deepEqual(at(120, events), at(120, events));
  assert.equal(at(0).label, '1:55');
});
