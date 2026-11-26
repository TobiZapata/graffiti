import seedrandom from 'seedrandom';
import { REPLAY_MAPS } from './replayMaps.mjs';

const sequences = {
  1: [[0, 'ban'], [0, 'ban'], [1, 'ban'], [1, 'ban'], [1, 'ban'], [0, 'ban']],
  3: [[0, 'ban'], [1, 'ban'], [0, 'pick'], [1, 'pick'], [1, 'ban'], [0, 'ban']],
  5: [[0, 'ban'], [1, 'ban'], [0, 'pick'], [1, 'pick'], [1, 'pick'], [0, 'pick']],
};
const other = team => team === 'A' ? 'B' : 'A';

export function createMapVeto(bestOf, seed, playerTeam = 'A') {
  if (![1, 3, 5].includes(bestOf) || !['A', 'B'].includes(playerTeam)) throw new Error('Invalid veto settings');
  return { version: 1, bestOf, firstTeam: seedrandom(`${seed}:veto:first`)() < 0.5 ? 'A' : 'B', actions: [] };
}

export function validMapVeto(veto, bestOf) {
  if (!veto || typeof veto !== 'object' || veto.version !== 1 || veto.bestOf !== bestOf ||
      ![1, 3, 5].includes(bestOf) || !['A', 'B'].includes(veto.firstTeam) ||
      !Array.isArray(veto.actions) || veto.actions.length > 6) return false;
  const seen = new Set();
  return Array.from(veto.actions).every((entry, index) => {
    const [side, action] = sequences[bestOf][index];
    if (!entry || typeof entry !== 'object' || entry.team !== (side ? other(veto.firstTeam) : veto.firstTeam) ||
        entry.action !== action || typeof entry.map !== 'string' || !Object.hasOwn(REPLAY_MAPS, entry.map) || seen.has(entry.map)) return false;
    seen.add(entry.map);
    return true;
  });
}

export function vetoStatus(veto) {
  if (!validMapVeto(veto, veto?.bestOf)) throw new Error('Invalid map veto');
  const remaining = Object.keys(REPLAY_MAPS).filter(map => !veto.actions.some(entry => entry.map === map));
  const next = sequences[veto.bestOf][veto.actions.length];
  const maps = veto.actions.filter(entry => entry.action === 'pick').map(entry => entry.map);
  if (!next) maps.push(remaining[0]);
  return { remaining, turn: next ? (next[0] ? other(veto.firstTeam) : veto.firstTeam) : null,
    action: next?.[1] ?? null, maps, done: !next };
}

export function applyMapVeto(veto, map) {
  const status = vetoStatus(veto);
  if (status.done || !status.remaining.includes(map)) throw new Error('Invalid veto map');
  return { ...veto, actions: [...veto.actions, { team: status.turn, action: status.action, map }] };
}

export function stepNpcVeto(veto, seed, playerTeam = 'A') {
  if (!['A', 'B'].includes(playerTeam)) throw new Error('Invalid player team');
  const status = vetoStatus(veto);
  if (status.done || status.turn === playerTeam) return veto;
  const random = seedrandom(`${seed}:veto:npc:${veto.actions.length}`)();
  return applyMapVeto(veto, status.remaining[Math.floor(random * status.remaining.length)]);
}

export function advanceNpcVeto(veto, seed, playerTeam = 'A') {
  let current = veto;
  let next = stepNpcVeto(current, seed, playerTeam);
  while (next !== current) {
    current = next;
    next = stepNpcVeto(current, seed, playerTeam);
  }
  return current;
}
