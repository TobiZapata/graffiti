import catalog from '../data/teams.json' with { type: 'json' };
import seedrandom from 'seedrandom';
import { formatTeamForSimulation } from '../app/utils/playerExpansion.js';
import { replayBestOf } from './replaySeries.mjs';

export const PLAYBACK_SPEEDS = Object.freeze([1, 2, 4]);
export const SINGLE_MATCH_BEST_OF = Object.freeze([1, 3, 5]);
export const roomCapacity = room => room.roomFormat === 'singleMatch' ? 2 : 8;

const catalogTeams = new Map(catalog.map(team => [String(team.id), team]));

function decodeTournament(tournament, players) {
  if (!tournament?.standings || !tournament.matches) return tournament;
  const playersByUid = new Map(players.map(player => [player.uid, player]));
  const teams = new Map(tournament.standings.map(team => {
    const { id, uid, catalogId, name } = team;
    if (team.players) return [id, { ...team, wins: 0, losses: 0 }];
    const random = seedrandom(`${tournament.tournamentId}:${id}`);
    if (uid !== undefined) {
      const player = playersByUid.get(uid);
      const org = player?.organization;
      const label = name ?? player?.teamName ?? player?.name ?? 'Player';
      const identity = { id, uid, name: label, isPlayer: true, wins: 0, losses: 0 };
      if (!org || !player.squad || (name !== undefined && name !== player.teamName)) {
        return [id, { ...identity, icon: '/ui/ct_logo.svg', players: [] }];
      }
      const simulation = formatTeamForSimulation({
        name: label, icon: player.icon, isPlayer: true, mainAwperUid: org.mainAwperUid, iglUid: org.iglUid,
      }, player.squad, random);
      return [id, { ...simulation, ...identity, playerName: player.name, organizationId: org.id, starUid: org.starUid }];
    }
    const source = catalogTeams.get(String(catalogId));
    return [id, { ...(source && formatTeamForSimulation(source, null, random)), id, catalogId,
      isPlayer: false, wins: 0, losses: 0 }];
  }));
  const matches = tournament.matches.map(match => {
    const teamA = match.teamA ?? { ...teams.get(match.teamAId), id: match.teamAId };
    const teamB = match.teamB ?? { ...teams.get(match.teamBId), id: match.teamBId };
    const result = match.result && { ...match.result, teamA, teamB };
    if (match.completed && result && typeof match.round === 'number') {
      const winner = teams.get(result.winner);
      const loser = teams.get(result.winner === teamA.id ? teamB.id : teamA.id);
      if (winner && loser) {
        winner.wins += 1;
        loser.losses += 1;
      }
    }
    return { ...match, teamA, teamB, result, isPlayerMatch: match.playerUids?.length > 0 || !!(teamA.isPlayer || teamB.isPlayer) };
  });
  return { ...tournament, standings: [...teams.values()], matches };
}

export function decodeRoom(room) {
  const rawPlayers = Array.isArray(room.players) ? room.players : Object.values(room.players || {});
  const players = rawPlayers.map(p => ({ ...p, squad: p.organization?.squad ?? p.squad,
    teamName: p.organization?.name ?? p.teamName, icon: p.organization?.icon ?? p.icon }));
  players.sort((a, b) => Number(b.uid === room.hostId) - Number(a.uid === room.hostId) || (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0));
  return { ...room, roomFormat: room.roomFormat ?? 'major', playbackSpeed: room.playbackSpeed ?? 1, players,
    ...(room.tournament && { tournament: decodeTournament(room.tournament, players) }) };
}

export function encodeMember({ uid, name, isHost, organization, participating, isReady, sessionId, left }) {
  return { uid, name, isHost, organization, participating, isReady, sessionId, left };
}

export function encodePlayers(players) {
  return Object.fromEntries(players.map(player => [player.uid, encodeMember(player)]));
}

export function encodeResult(result) {
  if (!result) return null;
  const { scoreA, scoreB, winner, maps, playerRatings, forfeit, forfeitUids } = result;
  return { scoreA, scoreB, winner, maps: maps.map(({ map, scoreA, scoreB, winnerId }) => ({ map, scoreA, scoreB, winnerId })),
    ...(playerRatings && { playerRatings }), ...(forfeit && { forfeit: true, forfeitUids }) };
}

export function encodeMatch(match) {
  const { id, round, teamA, teamB, playerUids, completed, result } = match;
  return { id, round, bestOf: replayBestOf(match), teamAId: match.teamAId ?? teamA.id, teamBId: match.teamBId ?? teamB.id,
    playerUids, completed, result: encodeResult(result) };
}

export function encodeTournament(tournament) {
  return { ...tournament, standings: tournament.standings.map(({ id, uid, catalogId, name }) => uid !== undefined
    ? { id, uid, name }
    : { id, catalogId: catalogId ?? catalogTeams.get(id.slice(4, id.lastIndexOf('_'))).id }),
  matches: tournament.matches.map(encodeMatch) };
}
