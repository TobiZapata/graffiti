import test from 'node:test';
import assert from 'node:assert/strict';
import { REPLAY_MAPS } from '../src/lib/replayMaps.mjs';
import { createMapVeto, vetoStatus, applyMapVeto, advanceNpcVeto, validMapVeto } from '../src/lib/mapVeto.mjs';

const patterns = {
  1: [[0, 'ban'], [0, 'ban'], [1, 'ban'], [1, 'ban'], [1, 'ban'], [0, 'ban']],
  3: [[0, 'ban'], [1, 'ban'], [0, 'pick'], [1, 'pick'], [1, 'ban'], [0, 'ban']],
  5: [[0, 'ban'], [1, 'ban'], [0, 'pick'], [1, 'pick'], [1, 'pick'], [0, 'pick']],
};

for (const bestOf of [1, 3, 5]) for (const playerTeam of ['A', 'B']) {
  test(`BO${bestOf} with player ${playerTeam}`, () => {
    let veto = createMapVeto(bestOf, 'seed', playerTeam);
    const initial = structuredClone(veto);
    assert.deepEqual(veto, createMapVeto(bestOf, 'seed', playerTeam));
    while (!vetoStatus(veto).done) {
      const before = structuredClone(veto);
      const next = advanceNpcVeto(veto, 'seed', playerTeam);
      assert.deepEqual(veto, before);
      assert.deepEqual(next, advanceNpcVeto(veto, 'seed', playerTeam));
      veto = next;
      const status = vetoStatus(veto);
      if (!status.done) {
        assert.equal(status.turn, playerTeam);
        veto = applyMapVeto(veto, status.remaining[0]);
      }
    }
    assert.deepEqual(initial.actions, []);
    assert.deepEqual(veto.actions.map(({ team, action }) => [team === veto.firstTeam ? 0 : 1, action]), patterns[bestOf]);
    const status = vetoStatus(veto);
    assert.equal(status.maps.length, bestOf);
    assert.equal(new Set([...veto.actions.map(a => a.map), ...status.remaining]).size, Object.keys(REPLAY_MAPS).length);
    assert.deepEqual(status.maps, [...veto.actions.filter(a => a.action === 'pick').map(a => a.map), status.remaining[0]]);
    assert.throws(() => applyMapVeto(veto, status.remaining[0]));
    assert.ok(validMapVeto(veto, bestOf));
  });
}

test('rejects malformed and inconsistent persisted vetoes', () => {
  const veto = createMapVeto(3, 'seed');
  const first = applyMapVeto(veto, vetoStatus(veto).remaining[0]);
  for (const bad of [null, {}, { ...veto, version: 2 }, { ...veto, firstTeam: 'C' },
    { ...veto, actions: {} }, { ...first, actions: [{ ...first.actions[0], team: 'C' }] },
    { ...first, actions: [{ ...first.actions[0], action: 'pick' }] },
    { ...first, actions: [{ ...first.actions[0], map: 'toString' }] },
    { ...first, actions: [{ ...first.actions[0], map: [first.actions[0].map] }] },
    { ...first, actions: [...first.actions, { team: veto.firstTeam === 'A' ? 'B' : 'A', action: 'ban', map: first.actions[0].map }] },
    { ...veto, actions: Array(7).fill(first.actions[0]) }]) assert.equal(validMapVeto(bad, 3), false);
  assert.equal(validMapVeto(veto, 5), false);
  assert.throws(() => applyMapVeto(first, first.actions[0].map));
  assert.throws(() => createMapVeto(2, 'seed'));
});
