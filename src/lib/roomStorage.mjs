export const PLAYBACK_SPEEDS = Object.freeze([1, 2, 4]);
export const SINGLE_MATCH_BEST_OF = Object.freeze([1, 3, 5]);
export const roomCapacity = room => room.roomFormat === 'singleMatch' ? 2 : 8;

export function decodeRoom(room) {
  const players = Array.isArray(room.players) ? room.players : Object.values(room.players || {});
  return { ...room, roomFormat: room.roomFormat ?? 'major', playbackSpeed: room.playbackSpeed ?? 1, players: [...players].sort((a, b) => Number(b.uid === room.hostId) - Number(a.uid === room.hostId) || (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0)) };
}

export function encodePlayers(players) {
  return Object.fromEntries(players.map(player => [player.uid, player]));
}
