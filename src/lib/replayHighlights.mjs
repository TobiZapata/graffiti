import seedrandom from 'seedrandom';

export function selectHighlightRounds(rounds, seed) {
  const count = Math.ceil(rounds.length / 3), selected = new Set();
  const random = seedrandom(`${seed}:highlights:v1`);
  const add = index => { if (index >= 0 && selected.size < count) selected.add(index); };
  const pistol = round => round.round === 1 || round.round === 13;
  const pick = candidates => candidates[Math.floor(random() * candidates.length)] ?? -1;
  const indexes = rounds.map((_, index) => index);
  indexes.filter(index => pistol(rounds[index])).forEach(add);
  add(rounds.findIndex((round, index) => {
    const previous = rounds[index - 1]?.macro;
    const matchpoint = round.round <= 24 ? 12 : 15 + Math.floor((round.round - 25) / 6) * 3;
    return previous && Math.max(previous.scoreTeam1, previous.scoreTeam2) >= matchpoint;
  }));
  add(rounds.length - 1);
  if (![...selected].some(index => rounds[index].clutch != null)) {
    add(pick(indexes.filter(index => rounds[index].clutch != null)));
  }
  for (const side of ['T', 'CT']) {
    if (![...selected].some(index => !pistol(rounds[index]) && rounds[index].macro.teamASide === side)) {
      add(pick(indexes.filter(index => !pistol(rounds[index]) && rounds[index].macro.teamASide === side)));
    }
  }
  while (selected.size < count) add(pick(indexes.filter(index => !selected.has(index))));
  return [...selected].sort((a, b) => a - b);
}
