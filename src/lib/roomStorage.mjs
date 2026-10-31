export function decodeRoom(room) {
  const players = Array.isArray(room.players) ? room.players : Object.values(room.players || {});
  return { ...room, players: [...players].sort((a, b) => Number(b.uid === room.hostId) - Number(a.uid === room.hostId) || (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0)) };
}

export function encodePlayers(players) {
  return Object.fromEntries(players.map(player => [player.uid, player]));
}
