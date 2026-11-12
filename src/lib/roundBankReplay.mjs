import { sampleRound } from './recordedReplay.mjs';
import { validWeaponAppearance, visibleWeapon, traceWeaponAppearances, weaponEvidenceFromRaw, validWeaponEvidence } from './weaponAppearance.mjs';
import { inventoryItem } from './replayEquipment.mjs';
import { isSideEndRound } from './replayResolution.mjs';
export { worldToRadar } from './recordedReplay.mjs';

const COLUMNS = ['x', 'y', 'z', 'yaw', 'health', 'alive', 'active_weapon', 'defusing', 'has_kit'];
const requireValue = (condition, message) => { if (!condition) throw new TypeError(`Replay inválido: ${message}`); };
const finite = value => typeof value === 'number' && Number.isFinite(value);
const tickInRange = (value, end) => Number.isInteger(value) && value >= 0 && value <= end;

function validateUtility(raw, duration) {
  for (const grenade of raw.grenades) {
    requireValue(typeof grenade.id === 'string' && typeof grenade.owner === 'string' &&
      finite(grenade.start) && finite(grenade.end) && grenade.start >= 0 && grenade.end >= grenade.start &&
      grenade.end <= duration && Array.isArray(grenade.points), 'trayectoria de granada');
    let previous = -1;
    for (const point of grenade.points) {
      requireValue([point.t, point.x, point.y, point.z].every(finite) && point.t >= grenade.start &&
        point.t <= grenade.end && point.t > previous, 'punto de granada');
      previous = point.t;
    }
  }
  for (const effect of raw.effects) {
    requireValue(typeof effect.id === 'string' && [effect.start, effect.end, effect.x, effect.y, effect.z].every(finite) &&
      effect.start >= 0 && effect.end >= effect.start && effect.end <= duration, 'efecto de utilidad');
  }
}

export function decodeReplay(raw, metadata, rosterNames = {}) {
  requireValue(raw?.schema_version === 1 && finite(raw.tick_rate) && raw.tick_rate > 0, 'versión o tick rate');
  requireValue(Number.isInteger(raw.end_tick) && raw.end_tick > 0 && tickInRange(raw.resolution_tick, raw.end_tick), 'límites');
  requireValue(Array.isArray(raw.actors) && raw.actors.length === 10 &&
    raw.actors.every(id => typeof id === 'string' && /^\d+$/.test(id)) && new Set(raw.actors).size === 10, 'diez actores únicos');
  requireValue(Array.isArray(raw.frame_columns) && raw.frame_columns.join('|') === COLUMNS.join('|'), 'columnas');
  requireValue(Array.isArray(metadata?.actors) && metadata.actors.length === 10, 'metadatos de actores');
  const appearance = metadata.weaponAppearance;
  requireValue(appearance === undefined || validWeaponAppearance(appearance), 'apariencia de armas');
  const sides = new Map(metadata.actors.map(actor => [actor.actor_id, actor.side]));
  requireValue(sides.size === 10 && raw.actors.every(id => ['T', 'CT'].includes(sides.get(id))) &&
    [...sides.values()].filter(side => side === 'T').length === 5, 'cinco actores por bando');
  requireValue(['T', 'CT'].includes(metadata.winner_side), 'ganador');
  for (const key of ['frames', 'events', 'inventory_changes', 'grenades', 'effects']) {
    requireValue(Array.isArray(raw[key]), key);
  }
  requireValue(raw.frames.length > 0, 'frames vacíos');
  const players = raw.actors.map((id, index) => ({ id, side: sides.get(id), name: rosterNames[id] ?? `${sides.get(id)} ${index + 1}` }));
  let previous = -1;
  const changeKeys = new Set();
  for (const change of raw.inventory_changes) {
    requireValue(Array.isArray(change) && change.length === 3, 'cambio de inventario');
    const [tick, actor, inventory] = change;
    requireValue(tickInRange(tick, raw.end_tick) && tick >= previous && Number.isInteger(actor) && actor >= 0 && actor < 10 &&
      Array.isArray(inventory) && inventory.every(weapon => typeof weapon === 'string'), 'inventario');
    requireValue(!changeKeys.has(`${tick}:${actor}`), 'inventario duplicado');
    changeKeys.add(`${tick}:${actor}`);
    previous = tick;
  }
  previous = -1;
  for (const event of raw.events) {
    requireValue(event && typeof event === 'object' && !Array.isArray(event) && typeof event.event === 'string' && tickInRange(event.tick, raw.end_tick) && event.tick >= previous, 'evento o tiempo');
    for (const [key, value] of Object.entries(event)) if (key === 'steamid' || key.endsWith('_steamid')) requireValue(typeof value === 'string', 'identidad del evento');
    previous = event.tick;
  }
  const suppliedEvidence = metadata.equipment?.weaponEvidence;
  requireValue(suppliedEvidence === undefined || validWeaponEvidence(suppliedEvidence, raw.actors,
    metadata.freezeAtResolution ? raw.resolution_tick : raw.end_tick), 'evidencia de armas');
  const evidence = suppliedEvidence ?? weaponEvidenceFromRaw(raw, sides);
  const trace = appearance ? traceWeaponAppearances(evidence, appearance) : null;
  const heldAt = (tick, actor) => {
    if (!trace) return [];
    let found = [];
    for (const frame of trace.frames) { if (frame.tick > tick) break; found = frame.holdings[actor] ?? []; }
    return found;
  };
  const weaponAt = (name, tick, actor, event = false) => {
    const id = inventoryItem(name)?.id;
    let target = (event ? trace?.eventWeapons[`${tick}:${actor}:${id}`] : undefined) ?? heldAt(tick, actor).find(token => token.original === id)?.visible;
    if (!target && trace) {
      for (const frame of trace.frames) { if (frame.tick > tick) break; target = frame.holdings[actor]?.find(token => token.original === id)?.visible ?? target; }
      target ??= appearance[actor]?.[id];
    }
    return target ? visibleWeapon(name, { [id]: target }) : name;
  };
  const inventories = new Map(), defuseStarts = new Map();
  let changeIndex = 0, previousTick = -1;
  const frames = raw.frames.map(frame => {
    requireValue(Array.isArray(frame) && frame.length === 2, 'frame');
    const [tick, rows] = frame;
    requireValue(tickInRange(tick, raw.end_tick) && tick > previousTick && Array.isArray(rows) && rows.length === 10, 'tiempo o roster del frame');
    while (changeIndex < raw.inventory_changes.length && raw.inventory_changes[changeIndex][0] <= tick) {
      const [, actor, inventory] = raw.inventory_changes[changeIndex++];
      inventories.set(actor, inventory);
    }
    const t = tick / raw.tick_rate;
    const normalized = rows.map((row, index) => {
      requireValue(Array.isArray(row) && row.length === 9 && row.slice(0, 5).every(finite) &&
        row[4] >= 0 && typeof row[5] === 'boolean' && (row[6] === null || typeof row[6] === 'string') &&
        typeof row[7] === 'boolean' && typeof row[8] === 'boolean' && inventories.has(index), 'estado del jugador');
      const [x, y, z, yaw, health, alive, weapon, defusing, hasKit] = row;
      if (!alive || !defusing || players[index].side !== 'CT') defuseStarts.delete(index);
      else if (!defuseStarts.has(index) || (tick - previousTick) / raw.tick_rate > .3) defuseStarts.set(index, t);
      return { ...players[index], x, y, z, yaw, health, alive, weapon: weaponAt(weapon, tick, players[index].id), defusing, hasKit,
        inventory: inventories.get(index).map(item => weaponAt(item, tick, players[index].id)), defuseStartedAt: defuseStarts.get(index) ?? null };
    });
    previousTick = tick;
    return { t, players: normalized };
  });
  requireValue(raw.frames[0][0] === 1 && previousTick === raw.end_tick, 'cobertura de inicio/final');
  previous = -1;
  const events = raw.events.map(event => {
    requireValue(event && typeof event === 'object' && typeof event.event === 'string' &&
      tickInRange(event.tick, raw.end_tick) && event.tick >= previous, 'evento o tiempo');
    for (const [key, value] of Object.entries(event)) {
      if (key === 'steamid' || key.endsWith('_steamid')) requireValue(typeof value === 'string', 'identidad del evento');
    }
    previous = event.tick;
    const result = { ...event, t: event.tick / raw.tick_rate, type: event.event, actor: event.steamid ?? event.user_steamid ?? 'unknown' };
    const weapon = weaponAt(event.weapon, event.tick, event.attacker_steamid ?? event.steamid ?? event.user_steamid, true);
    if (weapon !== event.weapon) { result.rawWeapon = event.weapon; result.weapon = weapon; }
    if (event.event === 'player_death' || event.event === 'player_hurt') result.victim = event.user_steamid;
    if (event.attacker_steamid) result.attacker = event.attacker_steamid;
    const attackerSide = sides.get(event.attacker_steamid);
    result.assister = event.event === 'player_death' && attackerSide && sides.has(event.user_steamid) &&
      attackerSide !== sides.get(event.user_steamid) && !['c4', 'planted_c4'].includes(event.weapon) &&
      event.assister_steamid !== event.attacker_steamid && sides.get(event.assister_steamid) === attackerSide
      ? event.assister_steamid : null;
    return result;
  });
  const duration = raw.end_tick / raw.tick_rate;
  validateUtility(raw, duration);
  const initialCarrier = frames[0].players.find(player => player.inventory.some(weapon => /^(c4|c4 explosive)$/i.test(weapon)));
  const round = { number: metadata.round, duration, players, sides: Object.fromEntries(sides), frames, events,
    grenades: raw.grenades, effects: raw.effects, initialBombCarrier: initialCarrier?.id ?? null,
    meta: { ...metadata, mode: 'recorded_replay', sampleHz: raw.sample_hz, tickRate: raw.tick_rate },
    result: { t: raw.resolution_tick / raw.tick_rate, winnerSide: metadata.winner_side, winCondition: metadata.win_condition } };
  if (metadata.freezeAtResolution || (metadata.macro && (metadata.endsMatch || isSideEndRound(metadata.round)))) {
    // Sample once before removing the tail, preserving deaths on the resolution tick.
    const frozen = sampleRound(round, round.result.t).players;
    round.events = events.filter(event => event.t <= round.result.t);
    round.frames = [...frames.filter(frame => frame.t < round.result.t), { t: round.result.t, players: frozen }];
    round.grenades = raw.grenades.filter(grenade => grenade.start <= round.result.t)
      .map(grenade => ({ ...grenade, end: Math.min(grenade.end, round.result.t) }));
    round.effects = raw.effects.filter(effect => effect.start <= round.result.t)
      .map(effect => ({ ...effect, end: Math.min(effect.end, round.result.t) }));
    round.duration = round.result.t + 7;
  } else if (isSideEndRound(metadata.source_round ?? metadata.round)) {
    round.duration = Math.min(duration, round.result.t + 7);
  }
  return round;
}

export function sampleReplay(round, seconds) {
  const state = sampleRound(round, seconds);
  for (const player of state.players) {
    player.defuse = player.alive && player.defusing && player.defuseStartedAt !== null && state.bomb?.status === 'planted'
      ? { startedAt: player.defuseStartedAt, duration: player.hasKit ? 5 : 10,
          progress: Math.min(1, Math.max(0, (state.time - player.defuseStartedAt) / (player.hasKit ? 5 : 10))), evidence: 'sampled_flag' }
      : null;
  }
  if (!state.bomb && round.initialBombCarrier && !state.events.some(event => event.type.startsWith('bomb_'))) {
    const carrier = state.players.find(player => player.id === round.initialBombCarrier);
    if (carrier?.alive) state.bomb = { status: 'carried', carrier: carrier.id, x: carrier.x, y: carrier.y, z: carrier.z, t: 0 };
  }
  return state;
}
