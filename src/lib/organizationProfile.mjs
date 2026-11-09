import { summarizeMatchPlayers } from './matchSummary.mjs';
import { validPlayerRatings } from './multiplayerResults.mjs';

export function buildMajorRecord({ tournamentId, stage, pendingResult, matches = [], mode = 'offline' }) {
  const finished = stage === 'won' || stage === 'eliminated' || stage === 'results_pending';
  const playerMatches = matches.filter(m => m.isPlayerMatch);
  const final = playerMatches.some(m => m.round === 'Final');
  const outcome = !finished ? 'active' : stage === 'won' || pendingResult === 'won' ? 'champion' :
    final ? 'finalist' : playerMatches.some(m => m.round === 'Semifinals') ? 'semifinal' :
    playerMatches.some(m => m.round === 'Quarterfinals') ? 'quarterfinal' : 'swiss';
  return {
    id: tournamentId, outcome, final, mode,
    matches: playerMatches.filter(m => m.completed).map(m => {
      const opponent = m.teamA.isPlayer ? m.teamB : m.teamA;
      return { name: opponent.name, major: opponent.major || '', icon: opponent.icon || '', organizationId: opponent.organizationId || '', won: m.result.winner === 'player_team' };
    })
  };
}

export function organizationProfile(organization, tournament = {}, mode) {
  let records = [...(organization?.majorHistory || [])];
  if (tournament.tournamentId) {
    const current = buildMajorRecord(tournament);
    const index = records.findIndex(record => record.id === current.id);
    if (index !== -1) records.splice(index, 1);
    records.push(current);
  }
  // shortcut: records saved before mode tracking count as offline; their original mode cannot be recovered.
  if (mode) records = records.filter(record => (record.mode || 'offline') === mode);
  const allMatches = records.flatMap(record => record.matches);
  const wins = allMatches.filter(match => match.won).length;
  const rivals = new Map();
  for (const match of allMatches) {
    const key = match.organizationId || JSON.stringify([match.name, match.major]);
    const rival = rivals.get(key) || { key, name: match.name, major: match.major, icon: match.icon || '', matches: 0, wins: 0 };
    if (match.icon) rival.icon = match.icon;
    rival.matches++;
    if (match.won) rival.wins++;
    rivals.set(key, rival);
  }
  return {
    matchesPlayed: allMatches.length, wins, winrate: allMatches.length ? wins / allMatches.length * 100 : null,
    majorsPlayed: records.length, championships: records.filter(r => r.outcome === 'champion').length,
    finals: records.filter(r => r.final).length,
    recentMajors: records.slice(tournament.tournamentId ? -4 : -3).reverse().map(({ id, outcome }) => ({ id, outcome })),
    rivals: [...rivals.values()].map(r => ({ ...r, winrate: r.wins / r.matches * 100 })).sort((a, b) => b.matches - a.matches || a.name.localeCompare(b.name)).slice(0, 5)
  };
}

export function playerRatingTotals(slot, matches = []) {
  let ratingTotal = slot.ratingTotal || 0, ratingMatches = slot.ratingMatches || 0;
  for (const match of matches) {
    if (!match.completed || !match.isPlayerMatch || match.result?.forfeit || !match.result?.maps?.length) continue;
    const side = match.teamA.isPlayer ? 'teamA' : 'teamB';
    const players = match[side].players;
    const playerIndex = players?.findIndex(player => player.personId && player.personId === slot.player.personId || player.name === slot.player.name);
    if (!(playerIndex >= 0)) continue;
    const rating = validPlayerRatings(match.result.playerRatings) ? match.result.playerRatings[(side === 'teamA' ? 0 : 5) + playerIndex] :
      summarizeMatchPlayers(match, match.result.maps)[side][playerIndex]?.rating;
    if (Number.isFinite(rating)) { ratingTotal += rating; ratingMatches++; }
  }
  return { ratingTotal, ratingMatches };
}

export function careerPlayerRating(slot, matches = []) {
  const { ratingTotal, ratingMatches } = playerRatingTotals(slot, matches);
  return ratingMatches ? ratingTotal / ratingMatches : null;
}
