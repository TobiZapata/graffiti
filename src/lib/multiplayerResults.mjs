import { replayBestOf, replaySeriesResult } from './replaySeries.mjs';
import { validMapPlayerStats } from './matchSummary.mjs';

export const matchResultId = (tournamentId, matchId) => `${tournamentId}~${matchId}`;

export function validMatchResult(match, result) {
  if (!(!!result && result.teamA?.id === match.teamA.id && result.teamB?.id === match.teamB.id &&
    Number.isInteger(result.scoreA) && Number.isInteger(result.scoreB) &&
    result.scoreA >= 0 && result.scoreB >= 0 && result.scoreA !== result.scoreB &&
    result.winner === (result.scoreA > result.scoreB ? match.teamA.id : match.teamB.id))) return false;
  const maps = result.maps;
  if (!Array.isArray(maps) || maps.length < 1 || maps.length > replayBestOf(match) || !maps.every(map =>
    map?.map === 'de_mirage' && validMapPlayerStats(match, map) && Number.isInteger(map.scoreA) && Number.isInteger(map.scoreB) && map.scoreA >= 0 && map.scoreB >= 0 &&
    map.scoreA !== map.scoreB && map.winnerId === (map.scoreA > map.scoreB ? match.teamA.id : match.teamB.id))) return false;
  const outcome = replaySeriesResult(match, maps);
  return outcome.done && !replaySeriesResult(match, maps.slice(0, -1)).done &&
    outcome.result.scoreA === result.scoreA && outcome.result.scoreB === result.scoreB && outcome.result.winner === result.winner;
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
