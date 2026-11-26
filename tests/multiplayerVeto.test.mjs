import test from 'node:test';
import assert from 'node:assert/strict';
import seedrandom from 'seedrandom';
import { vetoStatus } from '../src/lib/mapVeto.mjs';
import { advanceMultiplayerVeto, createMultiplayerVeto, validMultiplayerVeto, VETO_TURN_MS, vetoDocId } from '../src/lib/multiplayerVeto.mjs';

const vetoSeed = 'ROOM:major-1:R1_M0:veto';
const now = 100_000;
const create = (bestOf = 1) => createMultiplayerVeto('major-1', 'R1_M0', 0, bestOf, vetoSeed, now);

test('shared veto starts empty with a stable ID and a fresh deadline', () => {
  const doc = create();
  assert.equal(vetoDocId(doc.tournamentId, doc.matchId), 'major-1~R1_M0');
  assert.deepEqual(doc.veto.actions, []);
  assert.equal(doc.turnDeadlineMs, now + VETO_TURN_MS);
  assert.deepEqual(doc, create());
  assert.ok(validMultiplayerVeto(doc, 'major-1', 'R1_M0', 0, 1));
  for (const invalid of [null, { ...doc, matchIndex: 1 }, { ...doc, tournamentId: 'old' },
    { ...doc, veto: create(3).veto }, { ...doc, turnDeadlineMs: null }, { ...doc, turnDeadlineMs: Infinity }]) {
    assert.equal(validMultiplayerVeto(invalid, 'major-1', 'R1_M0', 0, 1), false);
  }
});

test('manual moves require the current player and turn, before the deadline', () => {
  const doc = create();
  const { turn, remaining } = vetoStatus(doc.veto);
  const move = { actionIndex: 0, playerTeam: turn, map: remaining[0], now: now + 100, vetoSeed };
  assert.equal(advanceMultiplayerVeto(doc, { ...move, playerTeam: turn === 'A' ? 'B' : 'A' }), null);
  assert.equal(advanceMultiplayerVeto(doc, { ...move, now: doc.turnDeadlineMs }), null);
  assert.throws(() => advanceMultiplayerVeto(doc, { ...move, map: 'invalid' }), /Invalid veto map/);
  const next = advanceMultiplayerVeto(doc, move);
  assert.equal(next.veto.actions[0].map, move.map);
  assert.equal(next.turnDeadlineMs, move.now + VETO_TURN_MS);
  assert.equal(vetoStatus(next.veto).turn, turn);
  assert.equal(advanceMultiplayerVeto(next, { ...move, map: remaining[1] }), null);
  assert.throws(() => advanceMultiplayerVeto(next, { ...move, actionIndex: 1 }), /Invalid veto map/);
  assert.deepEqual(doc, create());
});

for (const bestOf of [1, 3, 5]) {
  test(`either client can advance an expired BO${bestOf} turn exactly once`, () => {
    let doc = create(bestOf);
    for (let actionIndex = 0; actionIndex < 6; actionIndex++) {
      const { remaining } = vetoStatus(doc.veto);
      const timeout = { actionIndex, now: doc.turnDeadlineMs, vetoSeed };
      assert.equal(advanceMultiplayerVeto(doc, { ...timeout, now: timeout.now - 1 }), null);
      const next = advanceMultiplayerVeto(doc, { ...timeout, playerTeam: 'A' });
      assert.deepEqual(next, advanceMultiplayerVeto(doc, { ...timeout, playerTeam: 'B' }));
      const expected = Math.floor(seedrandom(`${vetoSeed}:timeout:${actionIndex}`)() * remaining.length);
      assert.equal(next.veto.actions.at(-1).map, remaining[expected]);
      assert.equal(advanceMultiplayerVeto(next, { ...timeout, now: timeout.now + VETO_TURN_MS }), null);
      assert.equal(next.turnDeadlineMs, actionIndex === 5 ? null : timeout.now + VETO_TURN_MS);
      doc = next;
    }
    const status = vetoStatus(doc.veto);
    assert.ok(status.done);
    assert.deepEqual(status.maps, [...doc.veto.actions.filter(action => action.action === 'pick').map(action => action.map), ...status.remaining]);
    assert.equal(status.maps.length, bestOf);
    assert.equal(advanceMultiplayerVeto(doc, { actionIndex: 6, now: now + 10 * VETO_TURN_MS, vetoSeed }), null);
    assert.ok(validMultiplayerVeto(doc, 'major-1', 'R1_M0', 0, bestOf));
    assert.equal(validMultiplayerVeto({ ...doc, turnDeadlineMs: now }, 'major-1', 'R1_M0', 0, bestOf), false);
  });
}
