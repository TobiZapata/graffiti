import { test } from 'node:test';
import { deepStrictEqual, equal } from 'node:assert';
import { decodeRoom, encodePlayers, encodeTournament } from '../src/lib/roomStorage.mjs';

test('room members decode host first and other UIDs in order, including legacy arrays', () => {
  const players = [{ uid: 'z' }, { uid: 'b' }, { uid: 'a' }];
  deepStrictEqual(decodeRoom({ hostId: 'b', players: encodePlayers(players) }).players.map(p => p.uid), ['b', 'a', 'z']);
  deepStrictEqual(decodeRoom({ hostId: 'b', players }).players.map(p => p.uid), ['b', 'a', 'z']);
});

test('compacts room state and restores historical Swiss matchups and results', () => {
  const organization = { id: 'org', name: 'Club', icon: '/club.png', squad: [{ player: { name: 'Rookie', aim: 80 }, assignedRole: 'AWPER' }] };
  const player = { uid: 'host', name: 'Host', isHost: true, organization, participating: true, isReady: true, sessionId: 'page', left: false,
    squad: organization.squad, teamName: organization.name, icon: organization.icon };
  const players = encodePlayers([player]);
  deepStrictEqual(Object.keys(players.host).sort(), ['isHost', 'isReady', 'left', 'name', 'organization', 'participating', 'sessionId', 'uid']);

  const human = { id: 'player_host', uid: 'host', name: organization.name, isPlayer: true, wins: 0, losses: 0 };
  const npc = { id: 'npc_1_0', catalogId: 1, name: 'fnatic', wins: 0, losses: 0, players: [{}] };
  const other = { id: 'npc_2_1', catalogId: 2, wins: 0, losses: 0 };
  const result = { teamA: npc, teamB: other, scoreA: 13, scoreB: 6, winner: npc.id,
    maps: [{ map: 'de_mirage', scoreA: 13, scoreB: 6, winnerId: npc.id, extra: true }] };
  const tournament = encodeTournament({ tournamentId: 'major', standings: [human, npc, other], matches: [
    { id: 'npc-game', round: 1, teamA: npc, teamB: other, playerUids: [], completed: true, isPlayerMatch: false, result },
    { id: 'human-game', round: 3, teamA: { ...human, wins: 2 }, teamB: npc, playerUids: ['host'], completed: false, isPlayerMatch: true, result: null },
  ] });
  deepStrictEqual(tournament.standings, [{ id: human.id, uid: 'host', name: 'Club' }, { id: npc.id, catalogId: 1 }, { id: other.id, catalogId: 2 }]);
  deepStrictEqual(tournament.matches[0], { id: 'npc-game', round: 1, bestOf: 1, teamAId: npc.id, teamBId: other.id, playerUids: [], completed: true,
    result: { scoreA: 13, scoreB: 6, winner: npc.id, maps: [{ map: 'de_mirage', scoreA: 13, scoreB: 6, winnerId: npc.id }] } });
  equal(tournament.matches[1].bestOf, 3);

  const stored = { hostId: 'host', players, tournament };
  const room = decodeRoom(stored);
  deepStrictEqual(room, decodeRoom(stored));
  equal(room.players[0].squad, organization.squad);
  equal(room.players[0].icon, organization.icon);
  equal(room.tournament.standings[1].wins, 1);
  equal(room.tournament.standings[2].losses, 1);
  const [npcMatch, humanMatch] = room.tournament.matches;
  equal(npcMatch.isPlayerMatch, false);
  equal(npcMatch.result.teamA.players.length, 5);
  equal(npcMatch.result.teamA.wins, 0);
  equal(npcMatch.result.teamB.id, other.id);
  equal(humanMatch.isPlayerMatch, true);
  equal(humanMatch.bestOf, 3);
  equal(humanMatch.teamA.players[0].name, 'Rookie');
  equal(humanMatch.teamB.wins, 1);

  const departed = decodeRoom({ ...stored, players: {} }).tournament.matches[1].teamA;
  const changed = decodeRoom({ ...stored, players: { host: { ...players.host, organization: { ...organization, name: 'New Club' } } } }).tournament.matches[1].teamA;
  deepStrictEqual(changed, departed);
  equal(departed.name, 'Club');
  equal(departed.icon, '/ui/ct_logo.svg');
  deepStrictEqual(departed.players, []);
});

test('decodes a legacy room with member aliases and full historical snapshots', () => {
  const teamA = { id: 'player_old', uid: 'old', name: 'Legacy', players: [{ name: 'Legacy player' }], isPlayer: true, wins: 2, losses: 0 };
  const teamB = { id: 'npc_1_0', name: 'Legacy rival', players: [] };
  const players = [{ uid: 'old', squad: ['old squad'], teamName: teamA.name, icon: '/old.png' }];
  const tournament = { standings: [teamA, teamB], matches: [{ id: 'old', round: 3, teamA, teamB, completed: true,
    result: { teamA, teamB, winner: teamA.id, scoreA: 2, scoreB: 0, maps: [] } }] };
  const room = decodeRoom({ players, tournament });
  deepStrictEqual(room.players, players);
  equal(room.tournament.matches[0].result.teamA, teamA);
  equal(room.tournament.matches[0].teamA.wins, 2);
  equal(room.tournament.standings[0].wins, 1);
});
