import test from 'node:test';
import assert from 'node:assert/strict';
import { assertFullRoster, benchRosterPlayer, departureProbabilities, expectedMajorOutcome, finishRosterMajor, promoteBenchPlayer, recruitRosterPlayer, releaseBenchPlayer, replacementOffer, swapBenchPlayer } from '../src/lib/rosterLifecycle.mjs';
const catalog = Array.from({length: 6}, (_, i) => ({id: i, name: `T${i}`, major: 'M', players: [{id: i, name: `P${i}`, rating: 80}]}));
const slot = i => ({player: catalog[i].players[0], team: {name: `T${i}`, major: 'M'}, gamesPlayed: i});
const org = () => ({id: 'club', squad: [0,1,2,3,4].map(slot), starUid: '4', iglUid: '1', mainAwperUid: '0', benchTokens: 1});
const major = id => ({tournamentId: id, stage: 'won', rosterTarget: 'champion', matches: [{completed: true, isPlayerMatch: true, round: 'Final', teamA: {isPlayer: true}, teamB: {name: 'Other'}, result: {winner: 'player_team'}}]});
test('bench, remap roles, swap and promote', () => {
 const b = benchRosterPlayer(org(), 1); assert.equal(b.benchTokens, 0); assert.equal(b.iglUid, '0'); assert.equal(b.starUid, '3');
 assert.throws(() => benchRosterPlayer(b, 0)); assert.throws(() => assertFullRoster(b));
 assert.equal(promoteBenchPlayer(swapBenchPlayer(b, 0)).squad.length, 5);
});
test('bench expires after two majors and completion is idempotent', () => {
 let b = finishRosterMajor(benchRosterPlayer(org(), 0), major('one'));
 assert.equal(b.bench.benchMajors, 1); assert.equal(b.benchTokens, 1); assert.strictEqual(finishRosterMajor(b, major('one')), b);
 const s = swapBenchPlayer(b, 0); assert.equal(s.squad[0].benchMajors, 1); assert.equal(swapBenchPlayer(s, 0).bench.benchMajors, 1);
 b = finishRosterMajor(b, major('two')); assert.equal(b.bench, null); assert.ok(b.rosterNotice.departed.some(p => p.reason === 'bench'));
});
test('archive bounded with incumbents winning ties', () => {
 const b = {...benchRosterPlayer(org(), 0), formerPlayers: [1,2,3,4,5].map(i => ({player: {name: `Old${i}`}, gamesPlayed: 10})), bench: {...slot(0), gamesPlayed: 10}};
 const r = releaseBenchPlayer(b); assert.equal(r.formerPlayers.length, 5); assert.ok(!r.formerPlayers.some(s => s.player.name === 'P0'));
});

test('promoting and benching again between Majors cannot renew bench tenure', () => {
 const b = { ...benchRosterPlayer(org(), 0), benchTokens: 1 };
 b.bench = { ...b.bench, benchMajors: 1 };
 const promoted = promoteBenchPlayer(b);
 const benched = benchRosterPlayer(promoted, 4);
 assert.equal(benched.bench.benchMajors, 1);
 assert.equal(benched.benchTokens, 0);
});
test('offers deterministic, selections validated and closure deterministic', () => {
 const o = org(), b = benchRosterPlayer(o, 0), offer = replacementOffer(b, catalog);
 assert.deepEqual(offer, replacementOffer(JSON.parse(JSON.stringify(b)), catalog));
 const duplicate = catalog.find(t => offer.includes(t.id) && b.squad.some(s => s.player.id === t.id));
 if (duplicate) assert.throws(() => recruitRosterPlayer(b, duplicate.players[0], duplicate, catalog));
 assert.throws(() => recruitRosterPlayer(b, {name: 'fake'}, catalog[0], catalog));
 assert.equal(expectedMajorOutcome(o, catalog), 'champion'); assert.deepEqual(departureProbabilities(o, major('x')), [65,30,5,0]);
 assert.deepEqual(finishRosterMajor(o, major('x')), finishRosterMajor(o, major('x')));
 assert.throws(() => benchRosterPlayer(o, -1)); assert.throws(() => finishRosterMajor(o, {...major('x'), matches: []}));
});

import { validOrganization } from '../src/lib/localCareer.mjs';
const validOrg = () => ({ ...org(), name: 'Club', icon: '/club.png', createdAt: '2026-01-01', colors: ['#ffffff', '#000000'], rosterVersion: 1, bench: null, formerPlayers: [] });
const fullWithBench = () => ({ ...benchRosterPlayer(validOrg(), 0), squad: [...benchRosterPlayer(validOrg(), 0).squad, slot(5)] });
const swiss = id => ({ ...major(id), stage: 'eliminated', matches: [{ ...major(id).matches[0], round: 1, result: { winner: 'other' } }] });
const completed = (state, prefix, event = major) => {
 for (let i = 0; i < 1000; i++) {
  const result = finishRosterMajor(state, event(`${prefix}-${i}`));
  if (result.rosterNotice.departed.every(entry => entry.reason !== 'performance')) return result;
 }
 throw new Error('No zero-departure seed found');
};

test('probability bands compare actual placement against target at each boundary', () => {
 const o = validOrg(), champion = major('p'), finalist = { ...champion, stage: 'eliminated' };
 assert.deepEqual(departureProbabilities(o, { ...champion, rosterTarget: 'finalist' }), [85, 15, 0, 0]);
 assert.deepEqual(departureProbabilities(o, { ...champion, rosterTarget: 'champion' }), [65, 30, 5, 0]);
 assert.deepEqual(departureProbabilities(o, { ...finalist, rosterTarget: 'champion' }), [40, 40, 17, 3]);
 assert.deepEqual(departureProbabilities(o, { ...swiss('p'), rosterTarget: 'champion' }), [20, 45, 25, 10]);
});

test('all departure counts are possible and repeat for the same IDs', () => {
 const o = validOrg(), counts = new Set();
 for (let i = 0; i < 500; i++) {
  const event = swiss(`draw-${i}`), first = finishRosterMajor(o, event);
  counts.add(first.rosterNotice.departed.length);
  assert.deepEqual(first, finishRosterMajor(o, event));
  assert.ok(validOrganization(first));
 }
 assert.deepEqual([...counts].sort(), [0, 1, 2, 3]);
});

test('the designated star never departs, including three departures after the worst result', () => {
 for (let star = 0; star < 5; star++) {
  const o = { ...validOrg(), starUid: String(star) };
  const name = o.squad[star].player.name;
  let sawThreeDepartures = false;
  for (let i = 0; i < 500; i++) {
   const result = finishRosterMajor(o, swiss(`protect-star-${i}`));
   assert.equal(result.squad[Number(result.starUid)].player.name, name);
   assert.ok(!result.rosterNotice.departed.some(entry => entry.name === name));
   assert.ok(!result.formerPlayers.some(entry => entry.player.name === name));
   assert.ok(validOrganization(result));
   if (result.rosterNotice.departed.length === 3) sawThreeDepartures = true;
  }
  assert.ok(sawThreeDepartures);
 }
});

test('bench expires after two completed majors and resulting organization persists', () => {
 const initial = fullWithBench(); initial.bench.gamesPlayed = 3;
 const first = completed(initial, 'bench-first');
 assert.equal(first.bench.benchMajors, 1); assert.equal(first.benchTokens, 1); assert.ok(validOrganization(first));
 assert.throws(() => benchRosterPlayer(first, 0));
 assert.equal(benchRosterPlayer(releaseBenchPlayer(first), 0).benchTokens, 0);
 const second = completed(first, 'bench-second');
 assert.equal(second.bench, null); assert.equal(second.formerPlayers.find(s => s.player.name === 'P0')?.gamesPlayed, 3);
 assert.ok(second.rosterNotice.departed.some(p => p.name === 'P0' && p.reason === 'bench'));
 assert.ok(validOrganization(second));
});

test('a former player returns with recorded games and leaves bounded history', () => {
 const base = validOrg();
 const o = { ...base, squad: base.squad.slice(0, 4), formerPlayers: [{ ...slot(5), gamesPlayed: 31 }] };
 const team = catalog[5];
 assert.ok(replacementOffer(o, [team]).includes(team.id));
 const result = recruitRosterPlayer(o, team.players[0], team, [team]);
 assert.equal(result.squad.at(-1).gamesPlayed, 31); assert.deepEqual(result.formerPlayers, []); assert.ok(validOrganization(result));
});

test('active player resets bench tenure only after playing a completed Major', () => {
 const initial = fullWithBench();
 const first = completed(initial, 'active-first');
 const promoted = swapBenchPlayer(first, 0);
 assert.equal(promoted.squad[0].benchMajors, 1);
 assert.equal(swapBenchPlayer(promoted, 0).bench.benchMajors, 1);
 const second = completed(promoted, 'active-second');
 assert.equal(second.squad.find(s => s.player.name === 'P0').benchMajors, 0);
 assert.ok(validOrganization(second));
});

test('forfeits do not add games and token cannot exceed one', () => {
 const o = validOrg(), event = major('forfeit'); event.matches[0].result.forfeit = true;
 const result = completed(o, 'forfeit', id => ({ ...event, tournamentId: id }));
 for (const player of result.squad) assert.equal(player.gamesPlayed, o.squad.find(s => s.player.name === player.player.name).gamesPlayed);
 assert.equal(result.benchTokens, 1); assert.ok(validOrganization(result));
 assert.throws(() => finishRosterMajor(o, { ...event, matches: [] }));
 assert.throws(() => finishRosterMajor(o, { ...event, stage: 'swiss' }));
});
