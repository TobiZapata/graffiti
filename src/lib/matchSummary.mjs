import { prepareReplayTeam } from './replayTeam.mjs';

import { derivePlayerMetrics } from './matchMetrics.mjs';

const fields = ['kills', 'deaths', 'assists', 'flashAssists'];
const metricFields = ['damage', 'kastRounds', 'swingTotal'];
export const hasMapMetrics = map => Array.isArray(map?.playerStats) && map.playerStats.length === 10 && map.playerStats.every(p => p && metricFields.every(field => Object.hasOwn(p, field)));
const roster = match => ['A', 'B'].map(side => prepareReplayTeam(match[`team${side}`]).players.map(player => ({ ...player, uid: `${side}:${player.uid}` })));

export function validMapPlayerStats(match, map) {
  if (!Object.hasOwn(map, 'playerStats')) return true;
  try {
    const players = roster(match).flat(), stats = map.playerStats, rounds = map.scoreA + map.scoreB;
    if (!Number.isSafeInteger(rounds) || rounds < 0 || !Array.isArray(stats) || stats.length !== players.length) return false;
    const ids = new Set(players.map(player => player.uid));
    return stats.every(player => player && Object.keys(player).every(key => ['uid', ...fields, ...metricFields].includes(key)) && ids.delete(player.uid) &&
      (Object.keys(player).length === 5 || (Object.keys(player).length === 8 &&
        Number.isSafeInteger(player.damage) && player.damage >= 0 && player.damage <= rounds * 500 &&
        Number.isSafeInteger(player.kastRounds) && player.kastRounds >= 0 && player.kastRounds <= rounds &&
        Number.isSafeInteger(player.swingTotal) && Math.abs(player.swingTotal) <= rounds * 50000)) &&
      fields.every(field => Number.isSafeInteger(player[field]) && player[field] >= 0 && player[field] <= rounds * (field === 'deaths' ? 1 : 5)) &&
      player.flashAssists <= player.assists);
  } catch { return false; }
}

export function createMapSummary(match, data) {
  const map = { map: data.map ?? 'de_mirage', scoreA: data.scoreTeam1, scoreB: data.scoreTeam2,
    winnerId: data.winner === 'A' ? match.teamA.id : match.teamB.id,
    playerStats: data.playerStats.map(({ uid, kills, deaths, assists, flashAssists, damage, kastRounds, swingTotal }) => ({ uid, kills, deaths, assists, flashAssists,
      ...(damage !== undefined ? { damage, kastRounds, swingTotal } : {}) })) };
  if (!['de_mirage', 'de_dust2'].includes(map.map) || !validMapPlayerStats(match, map)) throw new Error('Invalid map player statistics');
  return map;
}

export function summarizeMatchPlayers(match, maps) {
  const availableMaps = maps.filter(map => Object.hasOwn(map, 'playerStats') && validMapPlayerStats(match, map)).length;
  const complete = maps.length > 0 && availableMaps === maps.length;
  const metricsComplete = complete && maps.every(hasMapMetrics);
  const rounds = maps.reduce((sum, map) => sum + map.scoreA + map.scoreB, 0);
  const teams = roster(match).map(players => players.map(player => {
    const totals = Object.fromEntries([...fields, ...metricFields].map(field => [field, (metricFields.includes(field) ? metricsComplete : complete) ? 0 : null]));
    if (complete) for (const map of maps) {
      const stats = map.playerStats.find(row => row.uid === player.uid);
      for (const field of fields) totals[field] += stats[field];
      if (metricsComplete) for (const field of metricFields) totals[field] += stats[field];
    }
    return { ...player, ...totals, ...(metricsComplete ? derivePlayerMetrics({ ...totals, swing: totals.swingTotal }, rounds) : { adr: null, kast: null, swing: null, rating: null }) };
  }));
  return { teamA: teams[0], teamB: teams[1], complete, metricsComplete, availableMaps, totalMaps: maps.length };
}

export async function recoverMatchSummaryMaps(match, maps, loadMap, cachedMaps = [], preferMetrics = false, fallbackLoadMap) {
  const recovered = [];
  const sameResult = (a, b) => a?.map === b?.map && a?.scoreA === b?.scoreA && a?.scoreB === b?.scoreB && a?.winnerId === b?.winnerId;
  const preservesStats = (old, next) => !Object.hasOwn(old, 'playerStats') || !validMapPlayerStats(match, old) ||
    old.playerStats.every(player => fields.every(field => next.playerStats.find(p => p.uid === player.uid)?.[field] === player[field]));
  for (const [index, map] of maps.entries()) {
    if (Object.hasOwn(map, 'playerStats') && validMapPlayerStats(match, map) && (!preferMetrics || hasMapMetrics(map))) { recovered.push(map); continue; }
    const cached = cachedMaps[index];
    if (sameResult(map, cached) && Object.hasOwn(cached, 'playerStats') && validMapPlayerStats(match, cached) && preservesStats(map, cached) && (!preferMetrics || hasMapMetrics(cached))) { recovered.push(cached); continue; }
    let result = map;
    for (const load of [loadMap, fallbackLoadMap].filter(Boolean)) {
      try {
        const generated = createMapSummary(match, await load(index));
        if (sameResult(map, generated) && preservesStats(map, generated)) { result = generated; break; }
      } catch (error) {
        if (error?.name === 'AbortError') throw error;
      }
    }
    recovered.push(result);
  }
  return recovered;
}
