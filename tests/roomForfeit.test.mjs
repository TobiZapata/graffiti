import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyForfeits } from '../src/lib/roomForfeit.mjs';

const a = { id: 'a', uid: 'a', wins: 0, losses: 0 }, b = { id: 'b', uid: 'b', wins: 0, losses: 0 };
const tournament = (round = 1, abandonedUids = ['a']) => ({ abandonedUids, standings: [a, b], matches: [{ id: 'm', round, teamA: a, teamB: b, completed: false }] });

test('Swiss W/O updates standings once and keeps completed results', () => {
  const first = applyForfeits(tournament());
  assert.equal(first.matches[0].result.winner, 'b');
  assert.deepEqual([first.matches[0].result.scoreA, first.matches[0].result.scoreB], [0, 13]);
  assert.deepEqual(first.matches[0].result.maps, []);
  assert.deepEqual(first.standings.map(t => [t.wins, t.losses]), [[0, 1], [1, 0]]);
  assert.deepEqual(applyForfeits(first), first);
  const played = tournament(); played.matches[0] = { ...played.matches[0], completed: true, result: { winner: 'a' } };
  assert.deepEqual(applyForfeits(played).matches, played.matches);
});

test('BO3 and BO5 W/O and both abandoned use a deterministic winner', () => {
  for (const [round, score] of [['Quarterfinals', 2], ['Final', 3]]) {
    const result = applyForfeits(tournament(round, ['a', 'b'])).matches[0].result;
    assert.equal(result.winner, 'a');
    assert.deepEqual([result.scoreA, result.scoreB], [score, 0]);
    assert.deepEqual(result.forfeitUids, ['a', 'b']);
  }
});

test('abandoned team forfeits future Swiss pairings too', () => {
  const first = applyForfeits(tournament());
  const next = { ...first, matches: [...first.matches, { id: 'next', round: 2, teamA: a, teamB: b, completed: false }] };
  const resolved = applyForfeits(next);
  assert.equal(resolved.matches[1].result.winner, 'b');
  assert.deepEqual(resolved.standings.map(t => [t.wins, t.losses]), [[0, 2], [2, 0]]);
});
