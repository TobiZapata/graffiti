export function buildMajorRecord({ tournamentId, stage, pendingResult, matches = [] }) {
  const finished = stage === 'won' || stage === 'eliminated' || stage === 'results_pending';
  const playerMatches = matches.filter(m => m.isPlayerMatch);
  const final = playerMatches.some(m => m.round === 'Final');
  const outcome = !finished ? 'active' : stage === 'won' || pendingResult === 'won' ? 'champion' :
    final ? 'finalist' : playerMatches.some(m => m.round === 'Semifinals') ? 'semifinal' :
    playerMatches.some(m => m.round === 'Quarterfinals') ? 'quarterfinal' : 'swiss';
  return {
    id: tournamentId, outcome, final,
    matches: playerMatches.filter(m => m.completed).map(m => {
      const opponent = m.teamA.isPlayer ? m.teamB : m.teamA;
      return { name: opponent.name, major: opponent.major || '', won: m.result.winner === 'player_team' };
    })
  };
}

export function organizationProfile(organization, tournament = {}) {
  const records = [...(organization?.majorHistory || [])];
  if (tournament.tournamentId) {
    const current = buildMajorRecord(tournament);
    const index = records.findIndex(record => record.id === current.id);
    if (index !== -1) records.splice(index, 1);
    records.push(current);
  }
  const allMatches = records.flatMap(record => record.matches);
  const wins = allMatches.filter(match => match.won).length;
  const rivals = new Map();
  for (const match of allMatches) {
    const key = JSON.stringify([match.name, match.major]);
    const rival = rivals.get(key) || { key, name: match.name, major: match.major, matches: 0, wins: 0 };
    rival.matches++;
    if (match.won) rival.wins++;
    rivals.set(key, rival);
  }
  return {
    matchesPlayed: allMatches.length, wins, winrate: allMatches.length ? wins / allMatches.length * 100 : null,
    majorsPlayed: records.length, championships: records.filter(r => r.outcome === 'champion').length,
    finals: records.filter(r => r.final).length,
    recentMajors: records.slice(tournament.tournamentId ? -4 : -3).reverse().map(({ id, outcome }) => ({ id, outcome })),
    rivals: [...rivals.values()].map(r => ({ ...r, winrate: r.wins / r.matches * 100 })).sort((a, b) => b.matches - a.matches || a.name.localeCompare(b.name))
  };
}
