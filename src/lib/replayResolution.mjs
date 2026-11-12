export const isSideEndRound = round => Number.isInteger(round) && (round === 12 || round === 24 || (round >= 27 && (round - 27) % 3 === 0));

export function attachRoundResolutions(catalog, index) {
  if (!Array.isArray(catalog?.rounds) || index?.version !== 1 || !index.rounds || typeof index.rounds !== 'object') throw new TypeError('Invalid resolution index');
  return { ...catalog, rounds: catalog.rounds.map(round => {
    if (!round.eligible || !round.equipment?.supported) return round;
    const item = index.rounds[round.round_id];
    const ids = round.actors.map(actor => actor.actor_id);
    if (!item || item.sha256 !== round.replay_sha256 || !Array.isArray(item.actors) || item.actors.length !== 10 ||
        item.actors.some((actor, i) => actor.actor_id !== ids[i] || actor.side !== round.actors[i].side ||
          typeof actor.survived !== 'boolean' || ['kills', 'deaths', 'assists', 'flash_assists'].some(key => !Number.isInteger(actor[key]) || actor[key] < 0 || actor[key] > 5) ||
          actor.deaths !== Number(!actor.survived) || actor.flash_assists > actor.assists) ||
        !item.equipment?.supported || !item.metrics || Object.keys(item.metrics).length !== 10 ||
        ids.some(id => !Array.isArray(item.metrics[id]) || item.metrics[id].length !== 3 || !item.metrics[id].every(Number.isSafeInteger) ||
          item.metrics[id][0] < 0 || item.metrics[id][0] > 500 || ![0, 1].includes(item.metrics[id][1]) || Math.abs(item.metrics[id][2]) > 50000)) throw new TypeError(`Invalid resolution data: ${round.round_id}`);
    return { ...round, resolution: { actors: item.actors, equipment: item.equipment, metrics: item.metrics } };
  }) };
}

export function resolutionRound(source, targetRound, endsMatch = false) {
  if ((!isSideEndRound(targetRound) && !endsMatch) || !source.resolution) return source;
  return { ...source, ...source.resolution, freezeAtResolution: true };
}
