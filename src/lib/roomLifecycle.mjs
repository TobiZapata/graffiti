import { validOrganization } from './localCareer.mjs';

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
  if (!players.length || players.some(p => !p.isReady || !validOrganization(p.organization) || p.organization.squad.length !== 5)) throw new Error('Everyone in the room has to be ready.');
  if (new Set(players.map(p => p.organization.id)).size !== players.length) throw new Error('An organization cannot take part twice.');
  return players;
}

export function completedFinal(room) {
  const t = room?.tournament;
  const final = t?.matches?.find(m => m.round === 'Final' && m.completed);
  if (room?.status !== 'playing' || t?.stage !== 'won' || !final?.result || ![final.teamA?.id, final.teamB?.id].includes(final.result.winner)) throw new Error('The Major is not over yet.');
  return final;
}
