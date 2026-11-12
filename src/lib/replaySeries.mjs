import { validMapPlayerStats } from './matchSummary.mjs';

export function replayBestOf(match) {
  if (match.round === 'Final') return 5;
  if (['Quarterfinals', 'Semifinals'].includes(match.round)) return 3;
  return [match.teamA, match.teamB].some(team => team.wins === 2 || team.losses === 2) ? 3 : 1;
}

export function replaySeriesResult(match, history) {
  const bestOf = replayBestOf(match), mapsToWin = Math.ceil(bestOf / 2);
  const winsA = history.filter(map => map.winnerId === match.teamA.id).length;
  const winsB = history.filter(map => map.winnerId === match.teamB.id).length;
  const done = winsA >= mapsToWin || winsB >= mapsToWin;
  return { bestOf, winsA, winsB, done, result: done ? {
    teamA: match.teamA, teamB: match.teamB,
    winner: winsA > winsB ? match.teamA.id : match.teamB.id,
    scoreA: bestOf === 1 ? history[0].scoreA : winsA,
    scoreB: bestOf === 1 ? history[0].scoreB : winsB,
    maps: history,
  } : null };
}

export function validSeriesProgress(match, progress) {
  return !!progress && (progress.dust2BankVersion === undefined || progress.dust2BankVersion === 'v1.0.0') && (progress.map === undefined || ['de_mirage', 'de_dust2'].includes(progress.map)) && Array.isArray(progress.history) && progress.history.length < replayBestOf(match) &&
    progress.history.every(map => map && validMapPlayerStats(match, map) && ['de_mirage', 'de_dust2'].includes(map.map) && Number.isInteger(map.scoreA) && map.scoreA >= 0 &&
      Number.isInteger(map.scoreB) && map.scoreB >= 0 && (map.winnerId === match.teamA.id && map.scoreA > map.scoreB || map.winnerId === match.teamB.id && map.scoreB > map.scoreA)) &&
    !replaySeriesResult(match, progress.history).done && Number.isInteger(progress.watchedMap) &&
    progress.watchedMap >= -1 && progress.watchedMap <= progress.history.length &&
    (progress.playback === null || !!progress.playback && Number.isFinite(progress.playback.time) && progress.playback.time >= 0 &&
      [.5, 1, 2, 4, 8].includes(progress.playback.speed) && Number.isInteger(progress.playback.selection) && progress.playback.selection >= 0);
}
