import test from 'node:test';
import assert from 'node:assert/strict';
import { applySubmittedResults, compactMatchResult, validMatchResult, matchResultId } from '../src/lib/multiplayerResults.mjs';
import { careerPlayerRating } from '../src/lib/organizationProfile.mjs';
import { finishRosterMajor } from '../src/lib/rosterLifecycle.mjs';

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

test('compact online ratings roundtrip through submission and roster closure in roster order', () => {
  const team = (id, isPlayer) => ({ id, name: id, isPlayer, wins: 0, losses: 0,
    players: Array.from({ length: 5 }, (_, i) => ({ uid: String(i), name: `${id}-${i}` })) });
  const game = { ...match, isPlayerMatch: true, teamA: team('other', false), teamB: team('player_team', true) };
  const full = { teamA: game.teamA, teamB: game.teamB, scoreA: 7, scoreB: 13, winner: 'player_team', maps: [{ ...map, scoreA: 7, scoreB: 13, winnerId: 'player_team',
    playerStats: ['A', 'B'].flatMap(side => Array.from({ length: 5 }, (_, i) => ({ uid: `${side}:${i}`, kills: i + (side === 'A' ? 5 : 15), deaths: 14, assists: 4, flashAssists: 1, damage: 1500, kastRounds: 16, swingTotal: 0 }))) }] };
  assert.equal(validMatchResult(game, full), true);
  const compact = compactMatchResult(game, full);
  assert.equal(compact.playerRatings.length, 10);
  assert.ok(compact.playerRatings[5] > compact.playerRatings[0]);
  assert.equal(Object.hasOwn(compact.maps[0], 'playerStats'), false);
  assert.equal(validMatchResult(game, compact), true);
  const event = applySubmittedResults({ ...tournament, matches: [game], standings: [game.teamA, game.teamB] }, [{ ...submission, result: compact }]);
  const org = { id: 'rated-club', squad: game.teamB.players.map(player => ({ player })), starUid: '0', mainAwperUid: '0', iglUid: '1' };
  assert.equal(careerPlayerRating(org.squad[0], event.matches), compact.playerRatings[5]);
  const closed = finishRosterMajor(org, { ...event, stage: 'eliminated', rosterTarget: 'swiss', mode: 'online' });
  assert.equal(closed.squad[0].ratingMatches, 1);
  assert.equal(careerPlayerRating(closed.squad[0]), compact.playerRatings[5]);
  assert.strictEqual(finishRosterMajor(closed, { ...event, stage: 'eliminated', rosterTarget: 'swiss' }), closed);
  assert.equal(Object.hasOwn(compactMatchResult(match, result), 'playerRatings'), false);
});

test('rejects malformed optional compact ratings while accepting old results', () => {
  assert.equal(validMatchResult(match, { ...result, playerRatings: Array(10).fill(1.25) }), true);
  for (const playerRatings of [null, {}, Array(9).fill(1), Array(11).fill(1), [NaN, ...Array(9).fill(1)], [-0.1, ...Array(9).fill(1)], [10.1, ...Array(9).fill(1)], ['1', ...Array(9).fill(1)]]) {
    assert.equal(validMatchResult(match, { ...result, playerRatings }), false);
  }
});

test('accepts Dust2 results and rejects unknown maps', () => {
  assert.ok(validMatchResult(match, { ...result, maps: [{ ...map, map: 'de_dust2' }] }));
  assert.equal(validMatchResult(match, { ...result, maps: [{ ...map, map: 'de_other' }] }), false);
});
