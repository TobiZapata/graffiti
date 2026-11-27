import test from 'node:test';
import assert from 'node:assert/strict';
import { rosterMajorFromRoom } from '../src/lib/rosterRoom.mjs';
import { finishRosterMajor } from '../src/lib/rosterLifecycle.mjs';
import { organizationProfile } from '../src/lib/organizationProfile.mjs';
import { loadCareer, saveCareer } from '../src/lib/localCareer.mjs';

const squad = Array.from({ length: 5 }, (_, i) => ({ player: { name: `Player ${i}`, rating: 75 } }));
const organization = { id: 'club', squad, mainAwperUid: '0', iglUid: '1', starUid: '2' };
const me = { id: 'player_u', uid: 'u', name: 'My club', isPlayer: true, players: squad.map(s => s.player), wins: 0, losses: 3 };
const opponent = { ...me, id: 'player_v', uid: 'v', name: 'Opponent', wins: 3, losses: 0 };
const match = { id: 'm', round: 3, completed: true, isPlayerMatch: true, teamA: opponent, teamB: me, result: { winner: opponent.id } };
const room = () => ({ players: [{ uid: 'u', organization, squad }], tournament: { tournamentId: 'room-major', participantUids: ['u', 'v'], stage: 'swiss', standings: [me, opponent], matches: [match] } });

test('room closure records only our matches and normalizes either team side', () => {
  const r = room();
  r.tournament.matches.push({ ...match, teamB: { ...me, id: 'npc' } });
  const t = rosterMajorFromRoom(r, 'u', organization);
  assert.equal(t.stage, 'eliminated');
  assert.equal(t.mode, 'online');
  assert.equal(t.matches.length, 1);
  assert.equal(t.matches[0].teamB.id, 'player_team');
  assert.equal(t.matches[0].teamA.isPlayer, false);
  const closed = finishRosterMajor(organization, t);
  assert.equal(closed.majorHistory[0].matches[0].name, 'Opponent');
  assert.equal(closed.majorHistory[0].matches[0].won, false);
  assert.equal(closed.majorHistory[0].mode, 'online');
  assert.equal(closed.benchTokens, 1);
  assert.equal(rosterMajorFromRoom(r, 'u', closed), null);
});

test('room winners, spectators, abandoned players and unfinished Majors', () => {
  const r = room();
  assert.equal(rosterMajorFromRoom(r, 'spectator', organization), null);
  r.tournament.abandonedUids = ['u'];
  assert.equal(rosterMajorFromRoom(r, 'u', organization), null);
  delete r.tournament.abandonedUids;
  r.tournament.standings[0] = { ...me, losses: 0 };
  assert.equal(rosterMajorFromRoom(r, 'u', organization), null);
  r.tournament.stage = 'won';
  r.tournament.matches = [{ ...match, round: 'Final', result: { winner: me.id } }];
  const t = rosterMajorFromRoom(r, 'u', organization);
  assert.equal(t.stage, 'won');
  assert.equal(t.matches[0].result.winner, 'player_team');
  assert.equal(finishRosterMajor(organization, t).majorHistory[0].outcome, 'champion');
});

test('a finished single match records the online rival once and preserves all Major and roster state', () => {
  const org = { ...organization, name: 'My club', icon: '/icon', createdAt: '2026-01-01', colors: ['#123456', '#abcdef'],
    rosterVersion: 1, benchTokens: 0, bench: { player: { name: 'Reserve' }, benchMajors: 1 },
    majorHistory: [{ id: 'past', mode: 'online', outcome: 'champion', final: true, matches: [] }] };
  const r = { ...room(), roomFormat: 'singleMatch', status: 'playing' };
  const single = { ...match, id: 'single-match', round: 'Single match', bestOf: 3, playerUids: ['v', 'u'],
    teamA: { ...opponent, organizationId: 'rival' }, result: { winner: me.id } };
  r.tournament = { ...r.tournament, stage: 'single_match', matches: [{ ...single, completed: false, result: null }] };
  assert.equal(rosterMajorFromRoom(r, 'u', org, { includeActive: true }), null);
  r.tournament = { ...r.tournament, stage: 'won', matches: [single] };
  const settlement = rosterMajorFromRoom(r, 'u', org);
  assert.equal(organizationProfile(org, settlement, 'online').matchesPlayed, 1);
  const saved = finishRosterMajor(org, settlement);
  const { singleMatchHistory, ...preserved } = saved;
  assert.deepEqual(preserved, org);
  assert.equal(singleMatchHistory.length, 1);
  assert.equal(finishRosterMajor(saved, settlement), saved);
  assert.equal(rosterMajorFromRoom(r, 'u', saved), null);
  let raw;
  const storage = { getItem: () => raw, setItem: (_key, value) => { raw = value; } };
  assert.equal(saveCareer(storage, { version: 1, organization: saved, tournament: null, matchProgress: {} }), null);
  const persisted = loadCareer(storage).data.organization;
  assert.deepEqual(persisted, saved);
  const profile = organizationProfile(persisted, {}, 'online');
  assert.equal(profile.majorsPlayed, 1);
  assert.equal(profile.championships, 1);
  assert.equal(profile.matchesPlayed, 1);
  assert.deepEqual(profile.rivals.map(({ key, matches, wins }) => ({ key, matches, wins })), [{ key: 'rival', matches: 1, wins: 1 }]);
  assert.equal(organizationProfile(saved, {}, 'offline').matchesPlayed, 0);
});

test('live room profiles expose only our current matches without triggering early settlement or duplicates', () => {
  const r = room();
  r.tournament.standings[0] = { ...me, wins: 1, losses: 1 };
  r.players.push({ uid: 'v', organization: { id: 'opponent-club' } });
  r.tournament.matches.push({ ...match, id: 'unrelated', teamA: opponent, teamB: { ...me, id: 'npc' } });
  assert.equal(rosterMajorFromRoom(r, 'u', organization), null);
  for (const stage of ['swiss', 'swiss_complete', 'playoffs']) {
    r.tournament.stage = stage;
    const live = rosterMajorFromRoom(r, 'u', organization, { includeActive: true });
    assert.equal(live.stage, stage);
    assert.equal(live.matches.length, 1);
    assert.equal(live.matches[0].teamA.organizationId, 'opponent-club');
    assert.equal(live.matches[0].teamB.id, 'player_team');
    const profile = organizationProfile(organization, live, 'online');
    assert.equal(profile.matchesPlayed, 1);
    assert.equal(profile.recentMajors[0].outcome, 'active');
    assert.equal(organizationProfile(organization, live, 'offline').matchesPlayed, 0);
  }
  r.tournament.standings[0].losses = 3;
  const closed = finishRosterMajor(organization, rosterMajorFromRoom(r, 'u', organization));
  assert.equal(rosterMajorFromRoom(r, 'u', closed, { includeActive: true }), null);
  assert.equal(organizationProfile(closed, {}, 'online').matchesPlayed, 1);
  assert.equal(rosterMajorFromRoom(r, 'spectator', organization, { includeActive: true }), null);
  r.tournament.abandonedUids = ['u'];
  assert.equal(rosterMajorFromRoom(r, 'u', organization, { includeActive: true }), null);
});
