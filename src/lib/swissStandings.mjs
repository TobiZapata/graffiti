export function swissRoundResult(matches, teamId, round) {
  const match = matches.find(m => m.round === round && (m.teamA.id === teamId || m.teamB.id === teamId));
  if (!match) return null;
  const sideA = match.teamA.id === teamId;
  const completed = Boolean(match.completed && match.result);
  return {
    opponent: sideA ? match.teamB : match.teamA,
    completed,
    won: completed ? match.result.winner === teamId : null,
    score: !completed ? '—' : match.result.forfeit ? (match.result.winner === teamId ? 'W/O' : 'L/O') :
      `${sideA ? match.result.scoreA : match.result.scoreB}–${sideA ? match.result.scoreB : match.result.scoreA}`,
  };
}
