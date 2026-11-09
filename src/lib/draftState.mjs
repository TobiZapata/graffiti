import seedrandom from 'seedrandom';

export function sameDraftPlayer(a, b) {
  return a?.personId && b?.personId ? a.personId === b.personId : a?.name?.toLowerCase() === b?.name?.toLowerCase();
}

export function draftOffer(seed, depth, rerollsLeft, teams) {
  const random = seedrandom(`${seed}:${depth}:${rerollsLeft}`);
  const shuffled = [...teams];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, 3).map(team => team.id);
}

export function readDraft(saved, teams, legacyTeams = []) {
  if (!saved || !Array.isArray(saved.squad) || saved.squad.length > 5) return null;
  const squad = saved.squad.map(slot => {
    const catalog = Number.isFinite(slot?.player?.aim) ? [...legacyTeams, ...teams] : [...teams, ...legacyTeams];
    const team = catalog.find(t => t.name === slot?.team?.name && t.major === slot?.team?.major);
    const player = team?.players.find(p => slot?.player?.id != null ? p.id === slot.player.id : p.name === slot?.player?.name);
    if (!player) return null;
    const identity = teams.flatMap(t => t.players).find(p => p.id != null && p.id === player.id)?.personId;
    return { player: identity && !player.personId ? { ...player, personId: identity } : player, team: { name: team.name, major: team.major } };
  });
  if (squad.some(slot => !slot) || squad.some((slot, i) => squad.slice(0, i).some(other => sameDraftPlayer(slot.player, other.player)))) return null;
  return { squad, rerollsLeft: Number.isInteger(saved.rerollsLeft) && saved.rerollsLeft >= 0 && saved.rerollsLeft <= 3 ? saved.rerollsLeft : 0, seed: typeof saved.seed === 'string' && saved.seed.length > 0 && saved.seed.length <= 100 ? saved.seed : null };
}

export function removePick(draft, index) {
  return { ...draft, squad: draft.squad.slice(0, index) };
}
