import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMajorRecord, organizationProfile } from '../src/lib/organizationProfile.mjs';
import { loadCareer, validOrganization } from '../src/lib/localCareer.mjs';

const player = { id: 'player_team', isPlayer: true };
const opponent = { id: 'random_1', name: 'fnatic', major: '2013', isPlayer: false };
const match = (round, won, completed = true) => ({ round, teamA: player, teamB: opponent, isPlayerMatch: true, completed, result: completed ? { winner: won ? player.id : opponent.id, scoreA: 2, scoreB: 1 } : null });
const tournament = (id, stage, matches, pendingResult = null) => ({ tournamentId: id, stage, pendingResult, matches });
const org = { id:'id', name:'Team', icon:'/icon', colors:['#123456','#abcdef'], squad:Array.from({length:5},(_,i)=>({player:{name:`P${i}`}})), mainAwperUid:'0', iglUid:'1', starUid:'2', createdAt:'2026-01-01' };

test('aggregates finished and current series without counting maps or duplicates', () => {
  const previous = buildMajorRecord(tournament('one', 'won', [match(1, true), match('Final', true)]));
  const current = tournament('two', 'playoffs', [match(1, false), match('Final', false, false), { ...match(1, true), isPlayerMatch: false }]);
  const profile = organizationProfile({ majorHistory: [previous] }, current);
  assert.deepEqual([profile.matchesPlayed, profile.wins, profile.majorsPlayed, profile.championships, profile.finals], [3, 2, 2, 1, 2]);
  assert.equal(profile.rivals[0].matches, 3);
  assert.equal(profile.rivals[0].major, '2013');
  assert.deepEqual(profile.recentMajors.map(r => r.outcome), ['active', 'champion']);
  const duplicate = organizationProfile({ majorHistory: [previous] }, tournament('one', 'won', [match('Final', true)]));
  assert.equal(duplicate.majorsPlayed, 1);
  assert.equal(duplicate.matchesPlayed, 1);
});

test('outcomes, empty data, and recent history', () => {
  assert.equal(organizationProfile(org).winrate, null);
  assert.equal(organizationProfile(org).majorsPlayed, 0);
  for (const [round, outcome] of [['Final', 'finalist'], ['Semifinals', 'semifinal'], ['Quarterfinals', 'quarterfinal'], [1, 'swiss']]) {
    assert.equal(buildMajorRecord(tournament('x', 'results_pending', [match(round, false)], 'eliminated')).outcome, outcome);
  }
  const history = Array.from({ length: 5 }, (_, i) => buildMajorRecord(tournament(String(i), 'eliminated', [match(1, false)])));
  assert.deepEqual(organizationProfile({ majorHistory: history }).recentMajors.map(r => r.id), ['4', '3', '2']);
  assert.equal(organizationProfile({ majorHistory: history }, tournament('current', 'swiss', [])).recentMajors.length, 4);
});

test('history validation accepts old saves and preserves malformed saves', () => {
  const record = buildMajorRecord(tournament('one', 'won', [match('Final', true)]));
  assert.equal(validOrganization(org), true);
  assert.equal(validOrganization({ ...org, majorHistory: [record] }), true);
  assert.equal(validOrganization({ ...org, majorHistory: [record, record] }), false);
  const raw = JSON.stringify({ version: 1, organization: { ...org, majorHistory: [{ ...record, matches: 'invalid' }] }, tournament: null, matchProgress: {} });
  const store = { getItem: () => raw, setItem: () => { throw Error('must not write'); } };
  assert.ok(loadCareer(store).error);
  assert.equal(store.getItem(), raw);
});
