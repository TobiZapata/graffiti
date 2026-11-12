// shortcut: competitive timings; export server timers before supporting custom rules.
const ROUND_SECONDS = 115;
const BOMB_SECONDS = 40;

export function replayRoundTimer(round, sample) {
  const plant = sample.events.find(event => event.type === 'bomb_planted');
  if (plant) {
    const terminal = sample.events.find(event => event.t >= plant.t &&
      ['bomb_defused', 'bomb_exploded'].includes(event.type));
    const status = terminal?.type === 'bomb_defused' ? 'defused' :
      terminal?.type === 'bomb_exploded' ? 'exploded' : 'planted';
    return { status, progress: status === 'exploded' ? 1 :
      Math.max(0, Math.min(1, ((terminal?.t ?? sample.time) - plant.t) / BOMB_SECONDS)) };
  }
  const seconds = Math.ceil(Math.max(0, ROUND_SECONDS - Math.min(sample.time, round.result?.t ?? Infinity)));
  return { status: 'round', label: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` };
}
