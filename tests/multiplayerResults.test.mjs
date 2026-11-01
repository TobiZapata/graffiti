import test from 'node:test';
import assert from 'node:assert/strict';
import { applySubmittedResults, validMatchResult, matchResultId } from '../src/lib/multiplayerResults.mjs';

const a = { id: 'a', wins: 0, losses: 0 }, b = { id: 'b', wins: 0, losses: 0 };
const match = { id: 'm', round: 1, teamA: a, teamB: b, completed: false, playerUids: ['guest'] };
const tournament = { tournamentId: 'major', standings: [a, b], matches: [match] };
const map = { map: 'de_mirage', scoreA: 13, scoreB: 7, winnerId: 'a' };
const result = { teamA: a, teamB: b, scoreA: 13, scoreB: 7, winner: 'a', maps: [map] };
const submission = { tournamentId: 'major', matchId: 'm', matchIndex: 0, submittedBy: 'guest', result };

test('applies an individual result without mutating snapshots and counts it once', () => {
  const applied = applySubmittedResults(tournament, [submission]);
  assert.equal(applied.matches[0].completed, true);
  assert.equal(applied.standings[0].wins, 1);
  assert.equal(applied.standings[1].losses, 1);
  assert.deepEqual(applySubmittedResults(applied, [submission]), applied);
  assert.equal(tournament.matches[0].completed, false);
  assert.equal(a.wins, 0);
  assert.equal(matchResultId('major', 'm'), 'major~m');
});
test('ignores earlier Majors and does not change Swiss records for playoff results', () => {
  assert.deepEqual(applySubmittedResults(tournament, [{ ...submission, tournamentId: 'old' }]), tournament);
  const finalSubmission = { ...submission, result: { ...result, scoreA: 3, scoreB: 0, maps: [map, map, map] } };
  const applied = applySubmittedResults({ ...tournament, matches: [{ ...match, round: 'Final' }] }, [finalSubmission]);
  assert.deepEqual(applied.standings, tournament.standings);
  assert.equal(applied.matches[0].completed, true);
});
test('rejects another player, wrong index, invalid winner and malformed scores', () => {
  for (const bad of [{ ...submission, submittedBy: 'outsider' }, { ...submission, matchIndex: 1 },
    { ...submission, result: { ...result, winner: 'b' } }]) assert.throws(() => applySubmittedResults(tournament, [bad]));
  for (const scoreA of [-1, 1.5, NaN, 7]) assert.equal(validMatchResult(match, { ...result, scoreA }), false);
  assert.equal(validMatchResult(match, { ...result, teamB: { id: 'other' } }), false);
});
test('series results must agree with map scores and stop at the decisive map', () => {
  const bo3 = { ...match, round: 'Semifinals' };
  const won = { ...result, scoreA: 2, scoreB: 0, maps: [map, map] };
  assert.equal(validMatchResult(bo3, won), true);
  for (const maps of [[], [map], [map, map, map], [{ ...map, winnerId: 'b' }, map]]) {
    assert.equal(validMatchResult(bo3, { ...won, maps }), false);
  }
  assert.equal(validMatchResult(match, { ...result, scoreA: 14 }), false);
});
