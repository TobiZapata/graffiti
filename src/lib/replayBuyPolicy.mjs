import { WEAPONS } from '../app/engines/WeaponEngine.js';
import { inventoryItem, normalizeInventory } from './replayEquipment.mjs';
import { mustContestRound } from './replayRoundContext.mjs';

const primary = p => p.inventory.find(x => inventoryItem(x)?.kind === 'primary');
const pick = (items, random) => { let n = random() * items.reduce((s, x) => s + x[1], 0); for (const [v, w] of items) if ((n -= w) < 0) return v; return items.at(-1)[0]; };
const shuffled = (list, random) => { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

export function prepareReplayBuys(state, teamA, teamB, proposal, random = Math.random) {
  if (!state || !['T', 'CT'].includes(proposal?.teamASide) || !Number.isInteger(proposal.round) || proposal.round < 1 || typeof random !== 'function' || ![teamA, teamB].every(t => Array.isArray(t?.players) && t.players.length === 5) || !['A', 'B'].every(k => Array.isArray(state[k]?.players) && state[k].players.length === 5 && state[k].players.every(p => typeof p.uid === 'string' && Number.isFinite(p.money) && p.money >= 0 && p.money <= 16000 && normalizeInventory(p.inventory)?.length === p.inventory.length))) throw new TypeError('Datos de compra invalidos');
  const next = structuredClone(state), strategies = {}, actions = { A: [], B: [] };
  const round = proposal.round, pistol = round === 1 || round === 13, second = round === 2 || round === 14, third = round === 3 || round === 15;
  for (const [key, roster, side] of [['A', teamA, proposal.teamASide], ['B', teamB, proposal.teamASide === 'T' ? 'CT' : 'T']]) {
    const team = next[key], players = team.players, log = actions[key], order = shuffled(players, random);
    for (const p of players) {
      p.armor = Number.isFinite(p.armor) ? Math.max(0, Math.min(100, p.armor)) : 0;
      p.hasHelmet = !!p.hasHelmet && p.armor > 0; p.hasKit = side === 'CT' && !!p.hasKit;
      p.utilityStock = Number.isFinite(p.utilityStock) ? Math.max(0, p.utilityStock) : 0;
      p.armorValue = 0; p.utilityValue = 0; p.kitValue = 0;
      if (!['M4A1S', 'M4A4'].includes(p.m4Preference)) p.m4Preference = ['M4A1S', 'M4A4'].includes(roster.players[players.indexOf(p)].m4Preference) ? roster.players[players.indexOf(p)].m4Preference : (random() < 0.597 ? 'M4A1S' : 'M4A4');
      if (!p.inventory.some(x => inventoryItem(x).kind === 'pistol')) p.inventory.push(WEAPONS[side === 'T' ? 'GLOCK' : 'USP'].name);
      p.inventory = p.inventory.filter(x => inventoryItem(x).kind !== 'utility');
    }
    const mainIndex = roster.mainAwperUid !== undefined ? roster.players.findIndex((p, i) => (p.uid ?? String(i)) === roster.mainAwperUid) : roster.players.findIndex(p => p.isAwper === true || [p.role, p.rol1, p.rol2].some(r => typeof r === 'string' && r.toUpperCase() === 'AWPER'));
    const main = players[mainIndex], holder = players.find(p => p !== main && primary(p) && inventoryItem(primary(p)).id === 'AWP');
    if (main && holder && inventoryItem(primary(main))?.id !== 'AWP') {
      const awp = primary(holder), displaced = primary(main); holder.inventory.splice(holder.inventory.indexOf(awp), 1); if (displaced) main.inventory.splice(main.inventory.indexOf(displaced), 1); main.inventory.push(awp); if (displaced) holder.inventory.push(displaced);
      log.push({type:'transfer', item:awp, from:holder.uid, to:main.uid}); if (displaced) log.push({type:'transfer', item:displaced, from:main.uid, to:holder.uid});
    }
    const avg = players.reduce((s, p) => s + p.money, 0) / 5;
    const won = team.lastResult ?? team.recentWins?.at(-1) ?? (team.lossBonus === 1);
    const allIn = mustContestRound(proposal, key);
    const saved = players.filter(primary).length;
    const fullCost = p => (primary(p) ? 0 : WEAPONS[side === 'T' ? 'AK47' : p.m4Preference].cost) + (p.armor < 100 ? 650 : 0) + Math.max(0, 200 - p.utilityStock);
    const affordable = players.filter(p => p.money >= fullCost(p)).length;
    const payout = 1400 + 500 * (Math.max(1, Math.min(5, team.lossBonus ?? 1)) - 1);
    const canSave = saved < 3 && players.filter(p => p.money - Math.min(700, p.money) + payout >= fullCost(p)).length >= 4;
    const ordinary = () => affordable >= 4 ? 'FULL' : canSave ? pick([['ECO', 45], ['LIGHT', 15], ['FORCE', 40]], random) : avg >= 2600 ? 'FORCE' : avg >= 1700 ? 'LIGHT' : 'ECO';
    let profile = pistol ? 'PISTOL' : allIn ? 'FULL_DUMP' : second && won ? 'ANTI_ECO' : second && side === 'T' && !team.previousPlanted ? 'ECO' : second && (side === 'CT' || team.previousPlanted) ? 'FORCE' : third && team.recentWins?.length >= 2 && team.recentWins.slice(-2).every(Boolean) ? 'BONUS' : ordinary();
    if (second && !won && side === 'CT' && !allIn && random() >= 44 / 54) profile = 'ECO';
    strategies[key] = profile;
    const buy = (recipient, id, payer = recipient, reserve = 0) => {
      const w = WEAPONS[id], kind = inventoryItem(id)?.kind;
      if (!w || payer.money < w.cost + reserve || recipient.inventory.some(x => inventoryItem(x).id === id)) return false;
      const previous = recipient.inventory.find(x => inventoryItem(x).kind === kind);
      if (previous) recipient.inventory.splice(recipient.inventory.indexOf(previous), 1);
      payer.money -= w.cost; recipient.inventory.push(w.name); log.push({type:'buy', item:w.name, payer:payer.uid, to:recipient.uid, cost:w.cost}); return true;
    };
    const armor = (p, helmet, reserve = 0) => {
      let cost = p.armor < 100 ? 650 : 0;
      if (helmet && !p.hasHelmet) cost += 350;
      if (cost && p.money >= cost + reserve) { p.money -= cost; p.armorValue += cost; p.armor = 100; if (helmet) p.hasHelmet = true; }
    };
    const utility = (p, amount) => { const cost = Math.min(Math.max(0, amount - p.utilityStock), Math.floor(p.money / 50) * 50); p.money -= cost; p.utilityValue += cost; p.utilityStock += cost; };
    if (pistol) {
      const armored = pick(side === 'T' ? [[3,80],[4,11],[2,4],[5,3]] : [[3,33],[4,60],[5,5]], random);
      const upgrades = pick(side === 'T' ? [[0,53],[1,45]] : [[0,25],[1,55],[2,18]], random);
      for (const p of order.slice(0, armored)) armor(p, false);
      for (const p of shuffled(players, random).slice(0, upgrades)) {
        const id = side === 'T' ? 'P250' : 'DUALIES';
        const payer = p.money >= WEAPONS[id].cost ? p : players.find(x => x.money >= WEAPONS[id].cost);
        if (payer) buy(p, id, payer);
      }
      const supports = [...order.slice(armored), ...order.slice(0, armored)];
      if (side === 'CT' && random() < 20 / 98) { const p = supports.find(x => !x.hasKit && x.money >= 400); if (p) { p.money -= 400; p.kitValue += 400; p.hasKit = true; } }
      for (const p of supports) utility(p, side === 'T' ? 600 : 400);
      continue;
    }
    const reserve = profile === 'LIGHT' ? 1200 : profile === 'BONUS' ? 800 : 0;
    let partial = second && !won && side === 'T' && team.previousPlanted ? pick([[1,2],[2,6],[3,5],[4,1]], random) : 5;
    const wantsScout = second && !won && side === 'CT' && profile === 'FORCE' && random() < 32 / 44;
    if (wantsScout) { const p = main && !primary(main) ? main : order.find(x => !primary(x)); if (p) buy(p, 'SSG08'); }
    const allowAwp = ['FULL', 'FULL_DUMP'].includes(profile) || (profile === 'BONUS' && side === 'CT' && random() < 7 / 38);
    let awps = players.filter(p => inventoryItem(primary(p))?.id === 'AWP').length;
    const desiredAwps = allowAwp ? (side === 'CT' && random() < 0.08 ? 2 : random() < (side === 'CT' ? 0.75 : 0.60) ? 1 : 0) : 0;
    for (const p of [main, ...order].filter(Boolean)) if (awps < desiredAwps && (!primary(p) || ['MAC10','MP9'].includes(inventoryItem(primary(p)).id)) && buy(p, 'AWP', p, 650)) awps++;
    for (const p of order) {
      const held = inventoryItem(primary(p));
      if (held && (!['MAC10','MP9'].includes(held.id) || random() >= (profile === 'BONUS' ? 8 / 45 : 0.3))) continue;
      if (profile === 'ECO' || profile === 'LIGHT' || partial <= 0) continue;
      const choices = side === 'T' ? [['GALIL', profile === 'ANTI_ECO' ? 121 : 20], ['AK47', profile === 'ANTI_ECO' ? 81 : 75], ['MAC10', profile === 'ANTI_ECO' ? 65 : 5]] : [[p.m4Preference, profile === 'ANTI_ECO' ? 142 : 75], ['FAMAS', profile === 'ANTI_ECO' ? 22 : 20], ['MP9', profile === 'ANTI_ECO' ? 51 : 5]];
      const affordable = choices.filter(([id]) => p.money >= WEAPONS[id].cost + (allIn ? 0 : profile === 'BONUS' ? reserve : 650));
      if (affordable.length && buy(p, pick(affordable, random), p, allIn ? 0 : profile === 'BONUS' ? reserve : 650)) partial--;
    }
    if (['FULL','FULL_DUMP','ANTI_ECO'].includes(profile)) for (const p of order.filter(x => !primary(x))) {
      const id = side === 'T' ? 'GALIL' : 'FAMAS'; const payer = [...players].sort((a,b) => b.money - a.money).find(x => x !== p && x.money >= WEAPONS[id].cost + (allIn ? 0 : 1000)); if (payer) buy(p, id, payer);
    }
    for (const p of order) {
      const hasGun = !!primary(p), playerReserve = profile === 'ECO' ? Math.max(0, p.money - 700) : reserve, spending = Math.max(0, p.money - playerReserve);
      if (!hasGun) {
        const choices = [['P250', 30], ['DEAGLE', 30], [side === 'T' ? 'TEC9' : 'FIVESEVEN', 30], [null, 10]].filter(([id]) => !id || WEAPONS[id].cost <= spending);
        const pistol = pick(choices, random);
        if (pistol) buy(p, pistol, p, playerReserve);
      }
      if (profile !== 'ECO' && hasGun && !(wantsScout && inventoryItem(primary(p)).id === 'SSG08' && random() < 14 / 33)) armor(p, side === 'T' || random() < 0.75, profile === 'BONUS' ? reserve : 0);
      if (profile !== 'ECO' && side === 'CT' && hasGun && !p.hasKit && p.money >= 400 + reserve && (allIn || random() < 0.5)) { p.money -= 400; p.kitValue += 400; p.hasKit = true; }
      if (profile !== 'ECO' && hasGun && p.money > reserve) utility(p, Math.min(profile === 'BONUS' ? 600 : 1000, p.utilityStock + p.money - reserve));
    }
  }
  return {state:next, strategies, actions};
}
