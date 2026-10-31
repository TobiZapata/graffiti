import { replayBestOf } from './replaySeries.mjs';

export function applyForfeits(tournament) {
  const abandoned = new Set(tournament.abandonedUids || []);
  const standings = tournament.standings.map(team => ({ ...team }));
  const matches = tournament.matches.map(match => {
    if (match.completed) return match;
    const a = abandoned.has(match.teamA.uid), b = abandoned.has(match.teamB.uid);
    if (!a && !b) return match;
    const winner = a && !b ? match.teamB : match.teamA;
    const loser = winner === match.teamA ? match.teamB : match.teamA;
    if (typeof match.round === 'number') {
      const standingWinner = standings.find(team => team.id === winner.id);
      const standingLoser = standings.find(team => team.id === loser.id);
      if (!standingWinner || !standingLoser) throw new Error('Match teams are missing from standings.');
      standingWinner.wins += 1;
      standingLoser.losses += 1;
    }
    const score = replayBestOf(match) === 1 ? 13 : Math.ceil(replayBestOf(match) / 2);
    return { ...match, completed: true, result: {
      teamA: match.teamA, teamB: match.teamB, winner: winner.id,
      scoreA: winner === match.teamA ? score : 0, scoreB: winner === match.teamB ? score : 0,
      forfeit: true, forfeitUids: [a && match.teamA.uid, b && match.teamB.uid].filter(Boolean), maps: [],
    } };
  });
  return { ...tournament, standings, matches };
}
