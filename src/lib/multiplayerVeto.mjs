import seedrandom from 'seedrandom';
import { applyMapVeto, createMapVeto, validMapVeto, vetoStatus } from './mapVeto.mjs';

export const VETO_TURN_MS = 25_000;
export const vetoDocId = (tournamentId, matchId) => `${tournamentId}~${matchId}`;

export function createMultiplayerVeto(tournamentId, matchId, matchIndex, bestOf, vetoSeed, now) {
  return {
    tournamentId, matchId, matchIndex,
    veto: createMapVeto(bestOf, vetoSeed),
    turnDeadlineMs: now + VETO_TURN_MS,
  };
}

export function validMultiplayerVeto(doc, tournamentId, matchId, matchIndex, bestOf) {
  if (!doc || doc.tournamentId !== tournamentId || doc.matchId !== matchId || doc.matchIndex !== matchIndex ||
      !validMapVeto(doc.veto, bestOf)) return false;
  return vetoStatus(doc.veto).done
    ? doc.turnDeadlineMs === null
    : Number.isSafeInteger(doc.turnDeadlineMs) && doc.turnDeadlineMs > 0;
}

export function advanceMultiplayerVeto(doc, { actionIndex, playerTeam, map, now, vetoSeed }) {
  const { veto, turnDeadlineMs } = doc;
  const status = vetoStatus(veto);
  // A retry of an old move must be a no-op, even when the same team takes the next turn.
  if (status.done || veto.actions.length !== actionIndex) return null;

  if (map === undefined) {
    if (now < turnDeadlineMs) return null;
    const random = seedrandom(`${vetoSeed}:timeout:${actionIndex}`)();
    map = status.remaining[Math.floor(random * status.remaining.length)];
  } else if (playerTeam !== status.turn || now >= turnDeadlineMs) return null;

  const next = applyMapVeto(veto, map);
  return { ...doc, veto: next, turnDeadlineMs: vetoStatus(next).done ? null : now + VETO_TURN_MS };
}
