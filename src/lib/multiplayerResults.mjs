import { replayBestOf, replaySeriesResult } from './replaySeries.mjs';
import { hasMapMetrics, summarizeMatchPlayers, validMapPlayerStats } from './matchSummary.mjs';

export const matchResultId = (tournamentId, matchId) => `${tournamentId}~${matchId}`;
export const validPlayerRatings = ratings => Array.isArray(ratings) && ratings.length === 10 && ratings.every(value => Number.isFinite(value) && value >= 0 && value <= 10);

export function validMatchResult(match, result) {
  if (result && Object.hasOwn(result, 'playerRatings') && !validPlayerRatings(result.playerRatings)) return false;
  if (!(!!result && result.teamA?.id === match.teamA.id && result.teamB?.id === match.teamB.id &&
    Number.isInteger(result.scoreA) && Number.isInteger(result.scoreB) &&
    result.scoreA >= 0 && result.scoreB >= 0 && result.scoreA !== result.scoreB &&
    result.winner === (result.scoreA > result.scoreB ? match.teamA.id : match.teamB.id))) return false;
  const maps = result.maps;
  if (!Array.isArray(maps) || maps.length < 1 || maps.length > replayBestOf(match) || !maps.every(map =>
    ['de_mirage', 'de_dust2', 'de_nuke'].includes(map?.map) && validMapPlayerStats(match, map) && Number.isInteger(map.scoreA) && Number.isInteger(map.scoreB) && map.scoreA >= 0 && map.scoreB >= 0 &&
    map.scoreA !== map.scoreB && map.winnerId === (map.scoreA > map.scoreB ? match.teamA.id : match.teamB.id))) return false;
  const outcome = replaySeriesResult(match, maps);
  return outcome.done && !replaySeriesResult(match, maps.slice(0, -1)).done &&
    outcome.result.scoreA === result.scoreA && outcome.result.scoreB === result.scoreB && outcome.result.winner === result.winner;
}

export function compactMatchResult(match, result) {
  const compact = { teamA: match.teamA, teamB: match.teamB, scoreA: result.scoreA, scoreB: result.scoreB, winner: result.winner,
    maps: result.maps.map(({ map, scoreA, scoreB, winnerId }) => ({ map, scoreA, scoreB, winnerId })) };
  if (result.maps.every(hasMapMetrics)) {
    const summary = summarizeMatchPlayers(match, result.maps);
    if (summary.metricsComplete) {
      // Ratings follow team A's five roster slots, then team B's five slots.
      compact.playerRatings = [...summary.teamA, ...summary.teamB].map(player => player.rating);
      if (!validPlayerRatings(compact.playerRatings)) throw new Error('Invalid player ratings.');
    }
  }
  return compact;
}

// Results stay separate until the host advances; never count an incorporated result twice.
export function applySubmittedResults(tournament, submissions) {
  const pending = new Map(submissions.filter(s => s.tournamentId === tournament.tournamentId).map(s => [s.matchId, s]));
  const standings = tournament.standings.map(team => ({ ...team }));
  const matches = tournament.matches.map((match, index) => {
    const submission = pending.get(match.id);
    if (match.completed || !submission) return match;
    if (submission.matchIndex !== index || !match.playerUids?.includes(submission.submittedBy) || !validMatchResult(match, submission.result)) {
      throw new Error('A submitted match result is invalid.');
    }
    const result = { ...submission.result, teamA: match.teamA, teamB: match.teamB };
    if (typeof match.round === 'number') {
      const winner = standings.find(team => team.id === result.winner);
      const loser = standings.find(team => team.id === (result.winner === match.teamA.id ? match.teamB.id : match.teamA.id));
      if (!winner || !loser) throw new Error('Match teams are missing from standings.');
      winner.wins += 1;
      loser.losses += 1;
    }
    return { ...match, completed: true, result };
  });
  return { ...tournament, matches, standings };
}
