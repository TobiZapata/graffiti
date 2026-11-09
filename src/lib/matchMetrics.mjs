// Swing uses only the number alive, so it deliberately ignores time, bomb and equipment.
const winChance = (own, enemy) => own === 0 ? 0 : enemy === 0 ? 1 : own ** 2 / (own ** 2 + enemy ** 2);
const enemyKill = (event, sides) => sides.has(event.attacker_steamid) && sides.has(event.user_steamid) &&
  sides.get(event.attacker_steamid) !== sides.get(event.user_steamid) && !['c4', 'planted_c4'].includes(event.weapon);

// Values are keyed by the original replay actor, before assignment to simulated players.
export function calculateRoundMetrics(metadata, raw) {
  if (!Array.isArray(metadata?.actors) || metadata.actors.length !== 10 || !Array.isArray(raw?.events) ||
      !Array.isArray(raw.actors) || raw.actors.length !== 10 || new Set(raw.actors).size !== 10 ||
      !Number.isFinite(raw.tick_rate) || raw.tick_rate <= 0 || !Number.isInteger(raw.resolution_tick) || raw.resolution_tick < 0 ||
      metadata.actors.some(actor => typeof actor.survived !== 'boolean')) throw new TypeError('Invalid replay metrics input');
  const sides = new Map(metadata.actors.map(a => [a.actor_id, a.side]));
  if (sides.size !== 10 || raw.actors.some(id => !sides.has(id)) ||
      ['T', 'CT'].some(side => [...sides.values()].filter(value => value === side).length !== 5)) throw new TypeError('Invalid replay metrics actors');
  const output = Object.fromEntries(metadata.actors.map(actor => [actor.actor_id, { damage: 0, kastRounds: Number(actor.survived), swing: 0 }]));
  const health = new Map(metadata.actors.map(actor => [actor.actor_id, 100]));
  const alive = new Set(raw.actors);
  const deaths = [];
  let previousTick = -1;
  for (const event of raw.events) {
    if (!event || !Number.isInteger(event.tick) || event.tick < previousTick) throw new TypeError('Invalid replay event');
    previousTick = event.tick;
    const victim = event.user_steamid, attacker = event.attacker_steamid;
    if (event.event === 'player_hurt' && health.has(victim)) {
      if (!Number.isFinite(event.dmg_health) || event.dmg_health < 0) throw new TypeError('Invalid damage event');
      const applied = Math.min(health.get(victim), event.dmg_health);
      health.set(victim, health.get(victim) - applied);
      if (enemyKill(event, sides)) output[attacker].damage += applied;
    }
    if (event.event !== 'player_death' || !sides.has(victim)) continue;
    const kill = enemyKill(event, sides);
    if (kill) {
      output[attacker].kastRounds = 1;
      const assister = event.assister_steamid;
      if (assister !== attacker && sides.get(assister) === sides.get(attacker)) output[assister].kastRounds = 1;
    }
    if (event.tick <= raw.resolution_tick && alive.has(victim)) {
      if (kill) {
        const own = [...alive].filter(id => sides.get(id) === sides.get(attacker)).length;
        const enemy = alive.size - own;
        const change = Math.round((winChance(own, enemy - 1) - winChance(own, enemy)) * 10000);
        output[attacker].swing += change;
        output[victim].swing -= change;
        for (const death of deaths) {
          if (death.attacker === victim && sides.get(death.victim) === sides.get(attacker) &&
              event.tick - death.tick <= 5 * raw.tick_rate) output[death.victim].kastRounds = 1;
        }
        deaths.push({ attacker, victim, tick: event.tick });
      }
      alive.delete(victim);
    }
  }
  return output;
}

// Swing is stored in hundredths of a percentage point; all totals remain unrounded for series aggregation.
export function derivePlayerMetrics(totals, rounds) {
  if (!Number.isFinite(rounds) || rounds <= 0) return { swing: null, adr: null, kast: null, rating: null };
  const { kills, deaths, assists, damage, kastRounds, swing: swingTotal } = totals;
  if (![kills, deaths, assists, damage, kastRounds, swingTotal].every(Number.isFinite)) return { swing: null, adr: null, kast: null, rating: null };
  const swing = swingTotal / 100 / rounds, adr = damage / rounds, kast = kastRounds / rounds * 100;
  const rating = 1 + 0.55 * (kills / rounds - 0.65) - 0.4 * (deaths / rounds - 0.65) +
    0.15 * (assists / rounds - 0.15) + 0.003 * (adr - 75) + 0.004 * (kast - 70) + 0.015 * swing;
  return { swing, adr, kast, rating: Math.max(0, rating) };
}
