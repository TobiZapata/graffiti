// The compact sidecar follows source actor IDs; assignments move their real actions to our roster.
export function attachReplayMetrics(data, index) {
  if (index?.version !== 1 || !index.rounds) throw new Error('Unsupported round metrics');
  const totals = new Map(data.playerStats.map(p => [p.uid, { damage: 0, kastRounds: 0, swingTotal: 0 }]));
  for (const round of data.catalog.rounds) {
    const source = index.rounds[round.round_id];
    if (source?.sha256 !== round.replay_sha256) throw new Error('Round metrics do not match the replay bank');
    for (const assignment of round.assignments) {
      const row = (round.freezeAtResolution ? round.resolution.metrics : source.actors)[assignment.actorId], total = totals.get(assignment.playerUid);
      if (!total || !Array.isArray(row) || row.length !== 3 || !row.every(Number.isSafeInteger) ||
          row[0] < 0 || row[0] > 500 || ![0, 1].includes(row[1]) || Math.abs(row[2]) > 50000) throw new Error('Invalid round metrics');
      total.damage += row[0]; total.kastRounds += row[1]; total.swingTotal += row[2];
    }
  }
  return { ...data, playerStats: data.playerStats.map(p => ({ ...p, ...totals.get(p.uid) })) };
}
