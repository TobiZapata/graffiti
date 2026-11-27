import { validOrganization } from './localCareer.mjs';
import { SINGLE_MATCH_BEST_OF } from './roomStorage.mjs';
import { CURRENT_SIMULATION } from './simulationVersion.mjs';
import { formatTeamForSimulation } from '../app/utils/playerExpansion.js';

export function organizationSnapshot(org) {
  if (!validOrganization(org) || org.squad.length !== 5 || org.id.includes('/')) throw new Error('This organization is not valid.');
  const { id, name, icon, colors, squad, mainAwperUid, iglUid, starUid, createdAt } = org;
  return JSON.parse(JSON.stringify({ id, name, icon, colors, squad, mainAwperUid, iglUid, starUid, createdAt }));
}

export function member(uid, name, org, isHost = false) {
  const organization = organizationSnapshot(org);
  return { uid, name: name || 'Player', isHost, organization, participating: true, isReady: false, squad: organization.squad, teamName: organization.name, icon: organization.icon };
}

export function lobby(room) {
  if (!room || room.status !== 'lobby') throw new Error('The room is not in the lobby.');
}

export function readyPlayers(room) {
  lobby(room);
  const players = room.players.filter(p => !p.left);
  if (room.roomFormat === 'singleMatch' && (players.length !== 2 || players.some(p => !p.participating))) throw new Error('A single match requires exactly two participants.');
  if (!players.length || players.some(p => !p.isReady || !validOrganization(p.organization) || p.organization.squad.length !== 5)) throw new Error('Everyone in the room has to be ready.');
  if (new Set(players.map(p => p.organization.id)).size !== players.length) throw new Error('An organization cannot take part twice.');
  return players;
}

export function initializeSingleMatch(players, bestOf) {
  if (players.length !== 2 || !SINGLE_MATCH_BEST_OF.includes(bestOf)) throw new Error('Invalid single match format.');
  const standings = players.map(player => ({
    ...formatTeamForSimulation({ name: player.teamName, isPlayer: true, icon: player.icon,
      mainAwperUid: player.organization.mainAwperUid, iglUid: player.organization.iglUid }, player.squad),
    id: `player_${player.uid}`, uid: player.uid, playerName: player.name, isPlayer: true, organizationId: player.organization.id,
    starUid: player.organization.starUid, wins: 0, losses: 0,
  }));
  const [teamA, teamB] = standings;
  const match = { id: 'single-match', round: 'Single match', bestOf, teamA, teamB,
    playerUids: [teamA.uid, teamB.uid], isPlayerMatch: true, completed: false, result: null };
  return { simulation: CURRENT_SIMULATION, stage: 'single_match', swissRound: 1, standings, matches: [match] };
}

export function completedFinal(room) {
  const t = room?.tournament;
  const single = room?.roomFormat === 'singleMatch';
  const final = t?.matches?.find(m => m.round === (single ? 'Single match' : 'Final') && m.completed);
  if (room?.status !== 'playing' || t?.stage !== 'won' || !final?.result || ![final.teamA?.id, final.teamB?.id].includes(final.result.winner)) throw new Error(single ? 'The match is not over yet.' : 'The Major is not over yet.');
  return final;
}
