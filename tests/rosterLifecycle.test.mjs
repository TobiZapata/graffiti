import test from 'node:test';
import assert from 'node:assert/strict';
import { assertFullRoster, benchRosterPlayer, departureProbabilities, expectedMajorOutcome, finishRosterMajor, promoteBenchPlayer, recruitRosterPlayer, releaseBenchPlayer, replacementOffer, swapBenchPlayer } from '../src/lib/rosterLifecycle.mjs';
const catalog = Array.from({length: 6}, (_, i) => ({id: i, name: `T${i}`, major: 'M', players: [{id: i, name: `P${i}`, rating: 80}]}));
const slot = i => ({player: catalog[i].players[0], team: {name: `T${i}`, major: 'M'}, gamesPlayed: i});
const org = () => ({id: 'club', squad: [0,1,2,3,4].map(slot), starUid: '4', iglUid: '1', mainAwperUid: '0', benchTokens: 1});
const major = id => ({tournamentId: id, stage: 'won', rosterTarget: 'champion', matches: [{completed: true, isPlayerMatch: true, round: 'Final', teamA: {isPlayer: true}, teamB: {name: 'Other'}, result: {winner: 'player_team'}}]});

test('departing assigned specialists pass each role to the highest matching score', () => {
 const current = { ...org(), mainAwperUid: '0', iglUid: '0', squad: org().squad.map((slot, i) => ({ ...slot, player: { ...slot.player, awp: [99,50,90,70,60][i], igl: [99,80,40,95,50][i] } })) };
 const benched = benchRosterPlayer(current, 0);
 assert.equal(benched.mainAwperUid, '1'); assert.equal(benched.iglUid, '2'); assert.equal(benched.starUid, '3');
 const swapped = swapBenchPlayer({ ...current, bench: { player: { name: 'Incoming', awp: 30, igl: 30 } } }, 0);
 assert.equal(swapped.mainAwperUid, '2'); assert.equal(swapped.iglUid, '3');
 const retained = benchRosterPlayer({ ...current, iglUid: '1' }, 0);
 assert.equal(retained.iglUid, '0');
 const tied = benchRosterPlayer({ ...current, squad: current.squad.map(slot => ({ ...slot, player: { ...slot.player, awp: 50, igl: 50 } })) }, 0);
 assert.equal(tied.mainAwperUid, '0'); assert.equal(tied.iglUid, '0');
});

test('incoming natural specialists receive missing roles through recruitment, promotion and swaps', () => {
 const specialists = catalog.map(team => team.id === 5 ? { ...team, mainAwperUid: '5', iglUid: '5' } : team);
 const short = { ...org(), squad: [0,1,2,3].map(slot), starUid: '3', mainAwperUid: '0', iglUid: '1' };
 const recruited = recruitRosterPlayer(short, specialists[5].players[0], specialists[5], [specialists[5]]);
 const promoted = promoteBenchPlayer({ ...short, bench: slot(5) }, specialists);
 for (const updated of [recruited, promoted]) {
  assert.equal(updated.mainAwperUid, '4'); assert.equal(updated.iglUid, '4'); assert.equal(updated.starUid, '3');
 }
 const swapped = swapBenchPlayer({ ...org(), bench: slot(5) }, 2, specialists);
 assert.equal(swapped.mainAwperUid, '2'); assert.equal(swapped.iglUid, '2'); assert.equal(swapped.starUid, '4');
});

test('incoming specialists do not replace roles when another natural specialist remains', () => {
 const specialists = catalog.map(team => [0,5].includes(team.id) ? { ...team, mainAwperUid: String(team.id), iglUid: String(team.id) } : team);
 const current = { ...org(), squad: [0,1,2,3].map(slot), starUid: '3', bench: slot(5) };
 const updated = promoteBenchPlayer(current, specialists);
 assert.equal(updated.mainAwperUid, current.mainAwperUid); assert.equal(updated.iglUid, current.iglUid);
 const replaced = swapBenchPlayer({ ...org(), bench: slot(5) }, 0, specialists);
 assert.equal(replaced.mainAwperUid, '0'); assert.equal(replaced.iglUid, '0');
 const rifler = promoteBenchPlayer({ ...current, bench: slot(4) }, specialists);
 assert.equal(rifler.mainAwperUid, current.mainAwperUid); assert.equal(rifler.iglUid, current.iglUid);
});
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

test('rating totals survive Major closure, benching, release and recruitment without double counting', () => {
 const initial = validOrg(), event = major('rating-major');
 const team = (id, players, isPlayer = false) => ({ id, name: id, isPlayer, players: players.map((player, index) => ({ ...player, uid: String(index) })) });
 const match = event.matches[0];
 match.teamA = team('player_team', initial.squad.map(slot => slot.player), true);
 match.teamB = team('other', Array.from({ length: 5 }, (_, i) => ({ name: `Opponent ${i}` })));
 match.result.maps = [{ scoreA: 13, scoreB: 9, playerStats: ['A', 'B'].flatMap(side => Array.from({ length: 5 }, (_, i) => ({ uid: `${side}:${i}`, kills: 15, deaths: 14, assists: 4, flashAssists: 1, damage: 1650, kastRounds: 16, swingTotal: 0 }))) }];
 const closed = completed(initial, 'rating', id => ({ ...event, tournamentId: id }));
 assert.ok(validOrganization(closed));
 for (const slot of closed.squad) { assert.equal(slot.ratingMatches, 1); assert.ok(slot.ratingTotal > 0); }
 assert.strictEqual(finishRosterMajor(closed, { ...event, tournamentId: closed.majorHistory[0].id }), closed);
 const old = closed.squad[0], benched = benchRosterPlayer(closed, 0), released = releaseBenchPlayer(benched);
 const returning = catalog[0], recruited = recruitRosterPlayer(released, returning.players[0], returning, [returning]);
 assert.equal(recruited.squad.at(-1).ratingTotal, old.ratingTotal);
 assert.equal(recruited.squad.at(-1).ratingMatches, 1);
 assert.ok(validOrganization(recruited));
 assert.equal(validOrganization({ ...closed, squad: closed.squad.map((slot, i) => i ? slot : { ...slot, ratingMatches: -1 }) }), false);
});
