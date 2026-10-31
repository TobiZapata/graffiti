export function mustContestRound(proposal, team) {
  const { round } = proposal;
  const end = round === 12 || round === 24 || (round >= 27 && round % 3 === 0);
  const target = round <= 24 ? 13 : 16 + 3 * Math.floor((round - 25) / 6);
  const opponentScore = team === 'A' ? proposal.scoreTeam2 : proposal.scoreTeam1;
  return end || (Number.isFinite(opponentScore) && opponentScore >= target - 1);
}
