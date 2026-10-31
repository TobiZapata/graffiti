export function poolsByRecord(matches) {
  const grouped = {};
  const records = new Map();
  const rounds = [...new Set(matches.filter(m => typeof m.round === "number").map(m => m.round))].sort((a, b) => a - b);

  for (const round of rounds) {
    const roundMatches = matches.filter(m => m.round === round);
    for (const match of roundMatches) {
      const record = records.get(match.teamA.id) || { wins: 0, losses: 0 };
      const key = `${record.wins}-${record.losses}`;
      (grouped[key] ||= []).push(match);
    }
    for (const match of roundMatches) {
      if (!match.completed || ![match.teamA.id, match.teamB.id].includes(match.result?.winner)) continue;
      for (const team of [match.teamA, match.teamB]) {
        const record = records.get(team.id) || { wins: 0, losses: 0 };
        records.set(team.id, { wins: record.wins + (match.result.winner === team.id ? 1 : 0), losses: record.losses + (match.result.winner === team.id ? 0 : 1) });
      }
    }
  }
  return grouped;
}
