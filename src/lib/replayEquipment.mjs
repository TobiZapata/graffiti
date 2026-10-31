import { WEAPONS } from '../app/engines/WeaponEngine.js';

const pistols = new Set(['GLOCK', 'USP', 'P250', 'DEAGLE', 'DUALIES', 'TEC9', 'FIVESEVEN']);
const names = Object.fromEntries(Object.values(WEAPONS).filter(w => !['KNIFE', 'HE'].includes(w.id)).map(w => [w.name.toLowerCase(), w.id]));
Object.assign(names, { 'p2000': 'P2000', 'flashbang': 'FLASH', 'smoke grenade': 'SMOKE', 'he grenade': 'HE', 'high explosive grenade': 'HE', 'decoy grenade': 'DECOY', 'molotov': 'MOLOTOV', 'incendiary grenade': 'INCENDIARY' });
const extras = { P2000: { ...WEAPONS.USP, id: 'P2000', name: 'P2000' }, FLASH: { id: 'FLASH', name: 'Flashbang', cost: 200, side: 'BOTH', killReward: 0 }, SMOKE: { id: 'SMOKE', name: 'Smoke Grenade', cost: 300, side: 'BOTH', killReward: 0 }, HE: { ...WEAPONS.HE, name: 'HE Grenade', cost: 300 }, DECOY: { id: 'DECOY', name: 'Decoy Grenade', cost: 50, side: 'BOTH', killReward: 0 } };
Object.assign(names, { ak47: 'AK47', m4a1_silencer: 'M4A1S', m4a1: 'M4A4', galilar: 'GALIL', ssg08: 'SSG08', usp_silencer: 'USP', hkp2000: 'P2000', glock: 'GLOCK', deagle: 'DEAGLE', elite: 'DUALIES', tec9: 'TEC9', fiveseven: 'FIVESEVEN', mac10: 'MAC10', hegrenade: 'HE', smokegrenade: 'SMOKE', decoy: 'DECOY', incgrenade: 'INCENDIARY', inferno: 'MOLOTOV' });
const canonical = { MOLOTOV: 'Molotov', INCENDIARY: 'Incendiary Grenade' };
export function inventoryItem(name) {
  if (typeof name !== 'string') return null;
  const key = name.trim().toLowerCase().replace(/^weapon_/, '');
  const id = names[key] ?? (WEAPONS[key.toUpperCase()] && key.toUpperCase());
  if (!id || id === 'KNIFE') return null;
  const w = extras[id] ?? WEAPONS[id];
  if (!w) return null;
  return { id, cost: w.cost, side: w.side, killReward: w.killReward, kind: ['FLASH', 'SMOKE', 'HE', 'DECOY', 'MOLOTOV', 'INCENDIARY'].includes(id) ? 'utility' : (pistols.has(id) || id === 'P2000' ? 'pistol' : 'primary') };
}
export const itemName = name => { const item = inventoryItem(name); return item && (canonical[item.id] ?? extras[item.id]?.name ?? WEAPONS[item.id].name); };
export function mostExpensiveWeapon(inventory = []) {
  let weapon = null, price = -1;
  for (const name of inventory) {
    const item = inventoryItem(name);
    if (item && ['primary', 'pistol'].includes(item.kind) && item.cost > price) {
      weapon = name; price = item.cost;
    }
  }
  return weapon;
}
export function normalizeInventory(list) {
  if (!Array.isArray(list)) return null;
  const result = [];
  for (const name of list) {
    if (typeof name !== 'string') return null;
    if (/^(?:weapon_)?(?:knife.*|.*knife|.*bayonet.*|.*karambit.*|cuchillo|c4|c4\s*explosive)$/i.test(name.trim())) continue;
    const canonicalName = itemName(name);
    if (!canonicalName) return null;
    result.push(canonicalName);
  }
  return result;
}
