import { selectReplayMap } from './replayMaps.mjs';
import { createMacroDirector } from './macroDirector.mjs';
import { prepareReplayTeam } from './replayTeam.mjs';
import { replayBestOf, replaySeriesResult } from './replaySeries.mjs';
import { CURRENT_SIMULATION, simulationEngineVersion } from './simulationVersion.mjs';

// NPCs use the same seeded macro plan without fetching or assembling replay rounds.
export function simulateNpcMatch(match, tournamentId, simulation = CURRENT_SIMULATION, map = selectReplayMap(tournamentId, match.id)) {
  if (!['de_mirage', 'de_dust2'].includes(map)) throw new Error('Invalid map');
  const engineVersion = simulationEngineVersion(simulation);
  const teamA = prepareReplayTeam(match.teamA), teamB = prepareReplayTeam(match.teamB);
  const maps = [];
  let result;
  while (!(result = replaySeriesResult(match, maps)).done) {
    if (maps.length >= replayBestOf(match)) throw new Error('Invalid NPC series');
    const plan = createMacroDirector(teamA, teamB, `${tournamentId}:${match.id}-map${maps.length}`, engineVersion).plan;
    maps.push({ map, scoreA: plan.targetScore.A, scoreB: plan.targetScore.B,
      winnerId: plan.winnerTeam === 'A' ? match.teamA.id : match.teamB.id });
  }
  return result.result;
}
