import { WEAPONS } from '../app/engines/WeaponEngine.js';
import { inventoryItem, normalizeInventory } from './replayEquipment.mjs';

const group = id => {
  const item = inventoryItem(id);
  return item?.kind === 'primary' ? (['AWP', 'SSG08'].includes(id) ? id : 'primary') : item?.kind === 'pistol' ? 'pistol' : null;
};
const validActorMap = map => map && typeof map === 'object' && !Array.isArray(map) && Object.entries(map).every(([from, to]) =>
  typeof to === 'string' && inventoryItem(from)?.id === from && inventoryItem(to)?.id === to && group(from) && group(from) === group(to));
export function validWeaponAppearance(map) {
  return !!map && typeof map === 'object' && !Array.isArray(map) && Object.values(map).every(validActorMap);
}
export function visibleWeapon(name, map) {
  const id = inventoryItem(name)?.id, target = id && map?.[id];
  return target ? (normalizeInventory([target])?.[0] ?? name) : name;
}
export function buildWeaponAppearance(metadata, assignments, preparedState, appearance = {}) {
  if (!Array.isArray(assignments) || !metadata?.equipment?.actors || !Array.isArray(preparedState?.A?.players) || !Array.isArray(preparedState?.B?.players) || !validWeaponAppearance(appearance)) return null;
  const players = [...preparedState.A.players, ...preparedState.B.players], map = { ...appearance };
  if (new Set(assignments.map(a => a?.actorId)).size !== assignments.length || new Set(assignments.map(a => a?.playerUid)).size !== assignments.length) return null;
  for (const { actorId, playerUid } of assignments) {
    const source = metadata.equipment.actors[actorId]?.initialInventory, target = players.find(p => p.uid === playerUid)?.inventory;
    if (!Array.isArray(source) || !Array.isArray(target)) return null;
    const actorMap = { ...map[actorId] };
    for (const kind of ['primary', 'pistol']) {
      const from = source.map(inventoryItem).filter(i => i?.kind === kind), to = target.map(inventoryItem).filter(i => i?.kind === kind);
      if (from.length > 1 || to.length > 1 || from.length !== to.length) return null;
      if (!from.length) continue;
      if (group(from[0].id) !== group(to[0].id) || (actorMap[from[0].id] && actorMap[from[0].id] !== to[0].id)) return null;
      actorMap[from[0].id] = to[0].id;
    }
    map[actorId] = actorMap;
  }
  return map;
}

export function validWeaponEvidence(evidence, actors, endTick) {
  if (!evidence || !Array.isArray(actors) || !Number.isInteger(endTick) || endTick < 1 ||
    !['changes', 'deaths', 'pickups'].every(key => Array.isArray(evidence[key])) ||
    (evidence.endTick !== undefined && evidence.endTick !== endTick) ||
    (evidence.actors !== undefined && (!Array.isArray(evidence.actors) || evidence.actors.length !== actors.length || evidence.actors.some((id, index) => id !== actors[index])))) return false;
  const actor = id => actors.includes(id);
  const gun = id => inventoryItem(id)?.id === id && ['primary', 'pistol'].includes(inventoryItem(id).kind);
  const ordered = rows => rows.every((row, index) => Array.isArray(row) && Number.isInteger(row[0]) && row[0] >= 0 && row[0] <= endTick && (!index || row[0] >= rows[index - 1][0]));
  if (!['changes', 'deaths', 'pickups'].every(key => ordered(evidence[key]))) return false;
  return evidence.changes.every(row => row.length === 3 && actor(row[1]) && Array.isArray(row[2]) && row[2].every(gun)) &&
    actors.every(id => evidence.changes.some(row => row[0] === 1 && row[1] === id)) &&
    evidence.pickups.every(row => row.length === 3 && actor(row[1]) && gun(row[2])) &&
    evidence.deaths.every(row => row.length === 5 && actor(row[1]) && (actor(row[2]) || (!row[4] && (row[2] === null || typeof row[2] === 'string'))) && (typeof row[3] === 'string' || row[3] === null) && typeof row[4] === 'boolean');
}

export function weaponEvidenceFromRaw(raw, sides) {
  const side = id => sides instanceof Map ? sides.get(id) : sides[id];
  const last = {}, changes = [];
  for (const [tick, index, inventory] of raw.inventory_changes) {
    const actor = raw.actors[index];
    const ids = inventory.map(inventoryItem).filter(item => item && ['primary', 'pistol'].includes(item.kind)).map(item => item.id);
    const key = JSON.stringify(ids);
    if (last[actor] !== key) { changes.push([tick, actor, ids]); last[actor] = key; }
  }
  const deaths = raw.events.filter(event => event.event === 'player_death').map(event => {
    const victim = event.user_steamid, attacker = event.attacker_steamid ?? '', weapon = event.weapon ?? '';
    return [event.tick, victim, attacker, weapon, !!side(attacker) && !!side(victim) && side(attacker) !== side(victim) && !['c4', 'planted_c4'].includes(weapon)];
  });
  const pickups = raw.events.filter(event => event.event === 'item_pickup' && ['primary', 'pistol'].includes(inventoryItem(event.item)?.kind))
    .map(event => [event.tick, event.steamid ?? event.user_steamid, inventoryItem(event.item).id]);
  return { changes, deaths, pickups, endTick: raw.end_tick, actors: raw.actors, ...(raw.sample_hz > 0 && raw.tick_rate > 0 ? { sampleStep: raw.tick_rate / raw.sample_hz } : {}) };
}

export function traceWeaponAppearances(evidence, appearances = {}) {
  const holdings = {}, pool = [], pending = [], aliases = new Map(), frames = [], attacks = [];
  const dead = new Set(), seen = new Set();
  let nextId = 0, ambiguities = 0, created = 0;
  const changes = evidence?.changes ?? [], deaths = evidence?.deaths ?? [], pickups = evidence?.pickups ?? [];
  const tolerance = Math.ceil(evidence?.sampleStep || 8) * 2;
  const ticks = [...new Set([...changes, ...deaths, ...pickups].map(row => row[0]))].sort((a, b) => a - b);
  const release = (token, actor, tick) => {
    const ownPending = pending.findIndex(p => p.token === token);
    if (ownPending >= 0) pending.splice(ownPending, 1);
    const candidates = pending.filter(p => p.actor !== actor && p.token.original === token.original && tick - p.tick <= tolerance);
    if (candidates.length > 1) ambiguities++;
    if (candidates.length) {
      const match = candidates[0];
      aliases.set(match.token.id, token);
      created--;
      pending.splice(pending.indexOf(match), 1);
    } else pool.push(token);
  };
  const acquire = (actor, original, tick) => {
    const candidates = pool.filter(token => token.original === original).sort((a, b) => a.id - b.id);
    if (candidates.length > 1) ambiguities++;
    const token = candidates[0];
    if (token) { pool.splice(pool.indexOf(token), 1); return token; }
    created++;
    const fresh = { id: nextId++, original, visible: appearances[actor]?.[original] ?? original };
    if (seen.has(actor)) pending.push({ actor, token: fresh, tick });
    return fresh;
  };
  for (const tick of ticks) {
    const tickChanges = changes.filter(row => row[0] === tick && !dead.has(row[1]));
    const tickDeaths = deaths.filter(row => row[0] === tick);
    const beforeDeaths = Object.fromEntries(Object.entries(holdings).map(([actor, tokens]) => [actor, [...tokens]]));
    for (const [, victim] of tickDeaths) {
      dead.add(victim);
      for (const token of holdings[victim] ?? []) release(token, victim, tick);
      holdings[victim] = [];
    }
    for (const [, actor, ids] of tickChanges) {
      if (dead.has(actor)) continue;
      const wanted = [...ids], kept = [];
      for (const token of holdings[actor] ?? []) {
        const index = wanted.indexOf(token.original);
        if (index < 0) release(token, actor, tick); else { kept.push(token); wanted.splice(index, 1); }
      }
      holdings[actor] = kept;
    }
    for (const [, actor, ids] of tickChanges) {
      if (dead.has(actor)) continue;
      const wanted = [...ids];
      for (const token of holdings[actor] ?? []) { const i = wanted.indexOf(token.original); if (i >= 0) wanted.splice(i, 1); }
      holdings[actor] ??= [];
      for (const original of wanted) if (group(original)) holdings[actor].push(acquire(actor, original, tick));
      seen.add(actor);
    }
    for (const [, , attacker, weapon, credited] of tickDeaths) {
      const item = inventoryItem(weapon);
      const token = beforeDeaths[attacker]?.find(t => t.original === item?.id) ?? holdings[attacker]?.find(t => t.original === item?.id);
      attacks.push({ tick, attacker, weapon, credited, item, token });
    }
    frames.push({ tick, holdings: Object.fromEntries(Object.entries(holdings).map(([actor, tokens]) => [actor, [...tokens]])) });
  }
  const resolve = token => { while (token && aliases.has(token.id)) token = aliases.get(token.id); return token; };
  for (const frame of frames) for (const [actor, tokens] of Object.entries(frame.holdings)) frame.holdings[actor] = tokens.map(token => ({ ...resolve(token) }));
  const eventWeapons = {}, killRewards = {};
  for (const { tick, attacker, weapon, credited, item, token } of attacks) {
    const visible = resolve(token)?.visible ?? appearances[attacker]?.[item?.id] ?? item?.id;
    if (item && group(item.id)) eventWeapons[`${tick}:${attacker}:${item.id}`] = visible;
    if (credited) {
      const reward = /^(?:weapon_)?(?:knife.*|.*knife|.*bayonet.*|.*karambit.*|cuchillo)$/i.test(weapon ?? '') ? WEAPONS.KNIFE.killReward : inventoryItem(visible ?? weapon)?.killReward ?? 0;
      killRewards[attacker] = (killRewards[attacker] ?? 0) + reward;
    }
  }
  const finalInventories = Object.fromEntries(Object.entries(holdings).map(([actor, tokens]) => [actor, tokens.map(token => normalizeInventory([resolve(token).visible])[0])]));
  return { frames, finalInventories, killRewards, eventWeapons, ambiguities, created };
}
