import test from 'node:test';
import assert from 'node:assert/strict';
import { swissRoundResult } from '../src/lib/swissStandings.mjs';

const a = { id: 'a', name: 'A' }, b = { id: 'b', name: 'B' };
const match = { round: 1, teamA: a, teamB: b, completed: true, result: { winner: 'a', scoreA: 13, scoreB: 9 } };

test('Swiss results follow the row team perspective and retain the opponent', () => {
  assert.deepEqual(swissRoundResult([match], 'a', 1), { opponent: b, completed: true, won: true, score: '13–9' });
  assert.deepEqual(swissRoundResult([match], 'b', 1), { opponent: a, completed: true, won: false, score: '9–13' });
  assert.equal(swissRoundResult([match, { ...match, round: 'Final' }], 'a', 2), null);
  assert.equal(swissRoundResult([match], 'other', 1), null);
});

test('pending and forfeited matches do not invent scores', () => {
  assert.equal(swissRoundResult([{ ...match, completed: false, result: null }], 'a', 1).score, '—');
  const forfeit = { ...match, result: { ...match.result, forfeit: true } };
  assert.equal(swissRoundResult([forfeit], 'a', 1).score, 'W/O');
  assert.equal(swissRoundResult([forfeit], 'b', 1).score, 'L/O');
});
