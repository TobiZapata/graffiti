import { prepareReplayTeam } from './replayTeam.mjs';

const fields = ['kills', 'deaths', 'assists', 'flashAssists'];
const roster = match => ['A', 'B'].map(side => prepareReplayTeam(match[`team${side}`]).players.map(player => ({ uid: `${side}:${player.uid}`, name: player.name })));

export function validMapPlayerStats(match, map) {
  if (!Object.hasOwn(map, 'playerStats')) return true;
  try {
    const players = roster(match).flat(), stats = map.playerStats, rounds = map.scoreA + map.scoreB;
    if (!Number.isSafeInteger(rounds) || rounds < 0 || !Array.isArray(stats) || stats.length !== players.length) return false;
    const ids = new Set(players.map(player => player.uid));
    return stats.every(player => player && Object.keys(player).length === 5 && ids.delete(player.uid) &&
      fields.every(field => Number.isSafeInteger(player[field]) && player[field] >= 0 && player[field] <= rounds * (field === 'deaths' ? 1 : 5)) &&
      player.flashAssists <= player.assists);
  } catch { return false; }
}

export function createMapSummary(match, data) {
  const map = { map: 'de_mirage', scoreA: data.scoreTeam1, scoreB: data.scoreTeam2,
    winnerId: data.winner === 'A' ? match.teamA.id : match.teamB.id,
    playerStats: data.playerStats.map(({ uid, kills, deaths, assists, flashAssists }) => ({ uid, kills, deaths, assists, flashAssists })) };
  if (!validMapPlayerStats(match, map)) throw new Error('Invalid map player statistics');
  return map;
}

export function summarizeMatchPlayers(match, maps) {
  const availableMaps = maps.filter(map => Object.hasOwn(map, 'playerStats') && validMapPlayerStats(match, map)).length;
  const complete = maps.length > 0 && availableMaps === maps.length;
  const teams = roster(match).map(players => players.map(player => {
    const totals = Object.fromEntries(fields.map(field => [field, complete ? 0 : null]));
    if (complete) for (const map of maps) {
      const stats = map.playerStats.find(row => row.uid === player.uid);
      for (const field of fields) totals[field] += stats[field];
    }
    return { ...player, ...totals };
  }));
  return { teamA: teams[0], teamB: teams[1], complete, availableMaps, totalMaps: maps.length };
}

export async function recoverMatchSummaryMaps(match, maps, loadMap, cachedMaps = []) {
  const recovered = [];
  const sameResult = (a, b) => a?.map === b?.map && a?.scoreA === b?.scoreA && a?.scoreB === b?.scoreB && a?.winnerId === b?.winnerId;
  for (const [index, map] of maps.entries()) {
    if (Object.hasOwn(map, 'playerStats') && validMapPlayerStats(match, map)) { recovered.push(map); continue; }
    const cached = cachedMaps[index];
    if (sameResult(map, cached) && Object.hasOwn(cached, 'playerStats') && validMapPlayerStats(match, cached)) { recovered.push(cached); continue; }
    try {
      const generated = createMapSummary(match, await loadMap(index));
      recovered.push(sameResult(map, generated) ? generated : map);
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      recovered.push(map);
    }
  }
  return recovered;
}
