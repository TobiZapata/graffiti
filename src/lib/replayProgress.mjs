export function replayProgress(rounds, selection, round, sample) {
  const prior = rounds.slice(0, selection);
  const previous = prior.at(-1)?.macro;
  const score = [previous?.scoreTeam1 ?? 0, previous?.scoreTeam2 ?? 0];
  if (sample.result && round.meta.macro) score[round.meta.winner_side === round.meta.macro.teamASide ? 0 : 1]++;
  const players = new Map();
  for (const info of [...prior, round.meta]) {
    for (const assignment of info.assignments ?? []) {
      if (!players.has(assignment.playerUid)) players.set(assignment.playerUid, { name: assignment.name, team: assignment.team, kills: 0, deaths: 0, assists: 0, flashAssists: 0 });
      if (info === round.meta) continue;
      const actor = info.actors.find(a => a.actor_id === assignment.actorId);
      const stats = players.get(assignment.playerUid);
      stats.kills += actor.kills; stats.deaths += actor.deaths; stats.assists += actor.assists; stats.flashAssists += actor.flash_assists;
    }
  }
  const current = new Map((round.meta.assignments ?? []).map(a => [a.actorId, players.get(a.playerUid)]));
  for (const event of sample.events) {
    if (event.type !== 'player_death') continue;
    const victim = current.get(event.victim);
    if (victim) victim.deaths++;
    const attacker = current.get(event.attacker);
    if (!attacker || !round.sides[event.victim] || round.sides[event.attacker] === round.sides[event.victim] || ['c4', 'planted_c4'].includes(event.rawWeapon ?? event.weapon)) continue;
    attacker.kills++;
    const assister = current.get(event.assister);
    if (assister) { assister.assists++; if (event.assistedflash) assister.flashAssists++; }
  }
  return { score, players: [...players.values()] };
}
