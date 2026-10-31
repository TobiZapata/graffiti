import { rewardPlant, applyRoundEconomy, applyCTKillBonus } from '../app/engines/EconomyEngine.js';

import { inventoryItem, normalizeInventory } from './replayEquipment.mjs';
import { traceWeaponAppearances, validWeaponAppearance } from './weaponAppearance.mjs';
export { inventoryItem, normalizeInventory } from './replayEquipment.mjs';

const validTeam = team => team && Array.isArray(team.players) && team.players.length === 5 && Number.isInteger(team.lossBonus) && team.lossBonus >= 1 && team.lossBonus <= 5 && new Set(team.players.map(p => p?.uid)).size === 5 && team.players.every(p => typeof p?.uid === 'string' && p.uid.trim() && Number.isFinite(p.money) && p.money >= 0 && p.money <= 16000 && typeof p.hasKit === 'boolean' && normalizeInventory(p.inventory)?.length === p.inventory.length && p.inventory.every((item, i) => normalizeInventory(p.inventory)[i] === item));
const cloneTeam = team => ({ ...team, players: team.players.map(p => ({ ...p, inventory: normalizeInventory(p.inventory) })) });
const validState = state => validTeam(state?.A) && validTeam(state?.B) && new Set([...state.A.players, ...state.B.players].map(p => p.uid)).size === 10;
export function createReplayEconomy(teamA, teamB) {
  const make = (team, key) => ({ players: team.players.map((p, i) => ({ uid: `${key}:${p.uid ?? String(i)}`, money: 800, inventory: [], hasKit: false, armor: 0, hasHelmet: false, utilityStock: 0 })), lossBonus: 2, recentWins: [], lastResult: null, previousPlanted: false });
  if (![teamA, teamB].every(t => t && Array.isArray(t.players) && t.players.length === 5 && t.players.every(p => p && (p.uid === undefined || typeof p.uid === 'string' && p.uid.trim())))) throw new TypeError('Equipo inválido');
  const state = { A: make(teamA, 'A'), B: make(teamB, 'B') };
  if (!validState(state)) throw new TypeError('Identificadores duplicados');
  return state;
}
export function beginReplayRound(state, proposal) {
  if (!validState(state) || !Number.isInteger(proposal?.round) || proposal.round < 1) throw new TypeError('Estado o ronda inválidos');
  const next = { A: cloneTeam(state.A), B: cloneTeam(state.B) };
  const round = proposal.round;
  if (round === 1 || round === 13 || (round >= 25 && (round - 25) % 3 === 0)) for (const team of [next.A, next.B]) {
    team.lossBonus = 2; team.recentWins = []; team.lastResult = null; team.previousPlanted = false;
    for (const p of team.players) { p.money = round >= 25 ? 10000 : 800; p.inventory = []; p.hasKit = false; p.armor = 0; p.hasHelmet = false; p.utilityStock = 0; }
  }
  return next;
}
export { prepareReplayBuys } from './replayBuyPolicy.mjs';
export function finishReplayRound(state, metadata, assignments, proposal, appearance = {}) {
  if (!validState(state) || !Array.isArray(assignments) || assignments.length !== 10 || !Array.isArray(metadata?.actors) || !metadata.equipment || !['T', 'CT'].includes(proposal?.teamASide) || !['T', 'CT'].includes(proposal?.winnerSide)) throw new TypeError('Datos de ronda inválidos');
  if (!validWeaponAppearance(appearance)) throw new TypeError('Apariencia invalida');
  if (Object.keys(appearance).length && !metadata.equipment.weaponEvidence) throw new TypeError('Falta evidencia de armas para las apariencias');
  const trace = metadata.equipment.weaponEvidence ? traceWeaponAppearances(metadata.equipment.weaponEvidence, appearance) : null;
  const next = { A: cloneTeam(state.A), B: cloneTeam(state.B) }, players = [...next.A.players, ...next.B.players];
  if (new Set(assignments.map(a => a?.actorId)).size !== 10 || new Set(assignments.map(a => a?.playerUid)).size !== 10 || !assignments.every(a => players.some(p => p.uid === a.playerUid))) throw new TypeError('Asignaciones inválidas');
  if (metadata.actors.length !== 10 || new Set(metadata.actors.map(a => a?.actor_id)).size !== 10 || !assignments.every(a => {
    const actor = metadata.actors.find(item => item.actor_id === a.actorId);
    const team = next.A.players.some(p => p.uid === a.playerUid) ? 'A' : 'B';
    const side = team === 'A' ? proposal.teamASide : (proposal.teamASide === 'T' ? 'CT' : 'T');
    return actor && actor.side === side && (a.team === undefined || a.team === team);
  })) throw new TypeError('Bandos inválidos');
  const byActor = new Map(assignments.map(a => [a.actorId, players.find(p => p.uid === a.playerUid)]));
  for (const [id, player] of byActor) {
    const actor = metadata.actors.find(a => a.actor_id === id), equipment = metadata.equipment.actors?.[id];
    const inventory = normalizeInventory(equipment?.finalInventory);
    if (!actor || typeof actor.survived !== 'boolean' || !inventory || typeof equipment.finalHasKit !== 'boolean') throw new TypeError('Inventario final inválido');
    player.inventory = actor.survived ? (trace?.finalInventories[id] ?? inventory.filter(item => inventoryItem(item).kind !== 'utility')) : [];
    if (!actor.survived) { player.armor = 0; player.hasHelmet = false; player.hasKit = false; player.utilityStock = 0; }
    else {
      const count = items => items.filter(item => inventoryItem(item)?.kind === 'utility').length;
      const initialUtility = count(equipment.initialInventory ?? []);
      player.utilityStock = Math.round((player.utilityStock ?? 0) * (initialUtility ? Math.min(1, count(inventory) / initialUtility) : 1) / 50) * 50;
    }
  }
  const rewards = trace?.killRewards ?? metadata.equipment.killRewards ?? {};
  for (const [id, reward] of Object.entries(rewards)) {
    if (!byActor.has(id) || !Number.isFinite(reward) || reward < 0) throw new TypeError('Premio inválido');
    const player = byActor.get(id); player.money = Math.min(16000, player.money + reward);
  }
  if (!Array.isArray(metadata.equipment.planters) || !Number.isInteger(metadata.equipment.ctKills) || metadata.equipment.ctKills < 0) throw new TypeError('Premios inválidos');
  for (const id of metadata.equipment.planters) { if (!byActor.has(id)) throw new TypeError('Plantador inválido'); rewardPlant(byActor.get(id)); }
  const t = proposal.teamASide === 'T' ? next.A : next.B, ct = proposal.teamASide === 'CT' ? next.A : next.B;
  applyCTKillBonus(ct, metadata.equipment.ctKills); applyRoundEconomy(t, ct, proposal.winnerSide);
  for (const [key, team] of Object.entries(next)) {
    team.lastResult = (key === 'A' ? proposal.teamASide : proposal.teamASide === 'T' ? 'CT' : 'T') === proposal.winnerSide;
    team.recentWins = [...(team.recentWins ?? []), team.lastResult].slice(-2);
    team.previousPlanted = metadata.equipment.planters.length > 0;
  }
  return next;
}
