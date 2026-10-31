import { validOrganization } from './localCareer.mjs';

export function organizationSnapshot(org) {
  if (!validOrganization(org) || org.id.includes('/')) throw new Error('La organización no es válida.');
  const { id, name, icon, colors, squad, mainAwperUid, iglUid, starUid, createdAt } = org;
  return JSON.parse(JSON.stringify({ id, name, icon, colors, squad, mainAwperUid, iglUid, starUid, createdAt }));
}

export function member(uid, name, org, isHost = false) {
  const organization = organizationSnapshot(org);
  return { uid, name: name || 'Player', isHost, organization, participating: true, isReady: false, squad: organization.squad, teamName: organization.name, icon: organization.icon };
}

export function lobby(room) {
  if (!room || room.status !== 'lobby') throw new Error('La sala no está en el lobby.');
}

export function participation(player, participating) {
  return player.participating === participating ? player : { ...player, participating, isReady: false };
}

export function assertCanReady(player, ready) {
  if (ready && !player.participating) throw new Error('Un jugador excluido no puede estar listo.');
}

export function readyPlayers(room) {
  lobby(room);
  const players = room.players.filter(p => p.participating);
  if (!players.length || players.some(p => !p.isReady || !validOrganization(p.organization))) throw new Error('Todos los participantes deben estar listos.');
  if (new Set(players.map(p => p.organization.id)).size !== players.length) throw new Error('Una organización no puede participar dos veces.');
  return players;
}

export function completedFinal(room) {
  const t = room?.tournament;
  const final = t?.matches?.find(m => m.round === 'Final' && m.completed);
  if (room?.status !== 'playing' || t?.stage !== 'won' || !final?.result || ![final.teamA?.id, final.teamB?.id].includes(final.result.winner)) throw new Error('El Major todavía no terminó.');
  return final;
}
