import { WEAPONS } from '../app/engines/WeaponEngine.js';
import { inventoryItem } from './replayEconomy.mjs';

const special = {
  knife: 'knifes/knife', knife_t: 'knifes/knife_t',
  'm9 bayonet': 'knifes/knife_m9_bayonet', knife_m9_bayonet: 'knifes/knife_m9_bayonet',
  karambit: 'knifes/knife_karambit', knife_karambit: 'knifes/knife_karambit',
  'butterfly knife': 'knifes/knife_butterfly', knife_butterfly: 'knifes/knife_butterfly',
  'skeleton knife': 'knifes/knife_skeleton', knife_skeleton: 'knifes/knife_skeleton',
  'huntsman knife': 'knifes/knife_tactical', knife_tactical: 'knifes/knife_tactical',
  'talon knife': 'knifes/knife_widowmaker', knife_widowmaker: 'knifes/knife_widowmaker',
  'survival knife': 'knifes/knife_canis', knife_canis: 'knifes/knife_canis',
  'falchion knife': 'knifes/knife_falchion', knife_falchion: 'knifes/knife_falchion',
  'stiletto knife': 'knifes/knife_stiletto', knife_stiletto: 'knifes/knife_stiletto',
  'flip knife': 'knifes/knife_flip', knife_flip: 'knifes/knife_flip',
  c4: 'other/c4', 'c4 explosive': 'other/c4', c4explosive: 'other/c4', planted_c4: 'other/planted_c4',
  inferno: 'other/inferno', taser: 'other/taser', 'zeus x27': 'other/taser',
  defuser: 'other/defuser', icon_suicide: 'other/icon_suicide',
};
const utility = { FLASH: 'flashbang', SMOKE: 'smokegrenade', DECOY: 'decoy', MOLOTOV: 'molotov', INCENDIARY: 'incgrenade' };

export function replayWeaponIcon(weapon) {
  if (typeof weapon !== 'string') return null;
  const name = weapon.trim().toLowerCase().replace(/^weapon_/, '');
  if (Object.hasOwn(special, name)) return `/weapons/${special[name]}.svg`;
  const id = inventoryItem(weapon)?.id ?? name.toUpperCase();
  if (Object.hasOwn(utility, id)) return `/weapons/other/${utility[id]}.svg`;
  if (id === 'P2000') return null;
  return WEAPONS[id]?.image ?? null;
}
