import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMajorRecord, organizationProfile, careerPlayerRating, careerPlayerMatches, playerRatingTotals } from '../src/lib/organizationProfile.mjs';
import { loadCareer, validOrganization } from '../src/lib/localCareer.mjs';

const player = { id: 'player_team', isPlayer: true };
const opponent = { id: 'random_1', name: 'fnatic', major: '2013', isPlayer: false };
const match = (round, won, completed = true) => ({ round, teamA: player, teamB: opponent, isPlayerMatch: true, completed, result: completed ? { winner: won ? player.id : opponent.id, scoreA: 2, scoreB: 1 } : null });
const tournament = (id, stage, matches, pendingResult = null) => ({ tournamentId: id, stage, pendingResult, matches });
const org = { id:'id', name:'Team', icon:'/icon', colors:['#123456','#abcdef'], squad:Array.from({length:5},(_,i)=>({player:{name:`P${i}`}})), mainAwperUid:'0', iglUid:'1', starUid:'2', createdAt:'2026-01-01' };

test('active player match counts include current completed series without requiring ratings', () => {
  const slot = { player: { name: 'P0', personId: 'p0' }, gamesPlayed: 12 };
  const own = { isPlayer: true, players: [slot.player] }, npc = { isPlayer: false, players: [] };
  const played = { completed: true, isPlayerMatch: true, teamA: own, teamB: npc, result: {} };
  assert.equal(careerPlayerMatches(slot, [played, { ...played, teamA: npc, teamB: own }]), 14);
  assert.equal(careerPlayerMatches(slot, [{ ...played, completed: false }, { ...played, result: { forfeit: true } }, { ...played, isPlayerMatch: false }, { ...played, teamA: { ...own, players: [{ name: 'Other' }] } }]), 12);
  assert.equal(careerPlayerMatches({ player: slot.player }), 0);
});

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

test('separates offline and online history and limits rivals to five by played matches', () => {
  const records = Array.from({ length: 7 }, (_, i) => ({ id: `offline-${i}`, outcome: 'swiss', final: false,
    matches: Array.from({ length: i + 1 }, () => ({ name: `Team ${i}`, major: 'Major 2014', won: true, icon: `/team-${i}.png` })) }));
  const online = { ...records[0], id: 'online', mode: 'online', matches: [{ name: 'Club', major: '', won: false, icon: '/club.svg', organizationId: 'club' }] };
  const club = { majorHistory: [...records, online] };
  const offlineProfile = organizationProfile(club, {}, 'offline');
  assert.equal(offlineProfile.matchesPlayed, 28);
  assert.deepEqual(offlineProfile.rivals.map(r => r.name), ['Team 6', 'Team 5', 'Team 4', 'Team 3', 'Team 2']);
  assert.equal(offlineProfile.rivals[0].icon, '/team-6.png');
  assert.equal(organizationProfile(club, {}, 'online').matchesPlayed, 1);
  assert.equal(organizationProfile(club, {}, 'online').rivals[0].key, 'club');
  assert.equal(organizationProfile(club).matchesPlayed, 29);
  assert.equal(buildMajorRecord({ ...tournament('online-new', 'won', [match('Final', true)]), mode: 'online' }).mode, 'online');
});

test('career ratings use real series metrics, either side, and skip legacy or forfeited matches', () => {
  const team = (id, isPlayer) => ({ id, name: id, isPlayer, players: Array.from({ length: 5 }, (_, i) => ({ uid: String(i), name: `${id}-${i}` })) });
  const event = { teamA: team('other', false), teamB: team('player_team', true), completed: true, isPlayerMatch: true };
  event.result = { maps: [{ scoreA: 13, scoreB: 9, playerStats: ['A', 'B'].flatMap(side => Array.from({ length: 5 }, (_, i) => ({ uid: `${side}:${i}`, kills: 15, deaths: 14, assists: 4, flashAssists: 1, damage: 1650, kastRounds: 16, swingTotal: 0 }))) }] };
  const slot = { player: event.teamB.players[0], ratingTotal: 2, ratingMatches: 2 };
  const totals = playerRatingTotals(slot, [event]);
  assert.equal(totals.ratingMatches, 3);
  assert.ok(totals.ratingTotal > 2.9 && totals.ratingTotal < 3.1);
  assert.equal(careerPlayerRating(slot, [event]), totals.ratingTotal / 3);
  assert.deepEqual(playerRatingTotals(slot, [{ ...event, result: { maps: [{}] } }, { ...event, result: { ...event.result, forfeit: true } }]), { ratingTotal: 2, ratingMatches: 2 });
  assert.equal(careerPlayerRating({ player: slot.player }), null);
});
