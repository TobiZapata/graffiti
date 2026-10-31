import seedrandom from 'seedrandom';

export function draftOffer(seed, depth, rerollsLeft, teams) {
  const random = seedrandom(`${seed}:${depth}:${rerollsLeft}`);
  const shuffled = [...teams];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, 3).map(team => team.id);
}

export function readDraft(saved, teams) {
  if (!saved || !Array.isArray(saved.squad) || saved.squad.length > 5) return null;
  const squad = saved.squad.map(slot => {
    const team = teams.find(t => t.name === slot?.team?.name && t.major === slot?.team?.major);
    const player = team?.players.find(p => p.name === slot?.player?.name);
    return player ? { player, team: { name: team.name, major: team.major } } : null;
  });
  if (squad.some(slot => !slot) || new Set(squad.map(slot => slot.player.name.toLowerCase())).size !== squad.length) return null;
  return { squad, rerollsLeft: Number.isInteger(saved.rerollsLeft) && saved.rerollsLeft >= 0 && saved.rerollsLeft <= 3 ? saved.rerollsLeft : 0, seed: typeof saved.seed === 'string' && saved.seed.length > 0 && saved.seed.length <= 100 ? saved.seed : null };
}

export function removePick(draft, index) {
  return { ...draft, squad: draft.squad.slice(0, index) };
}
