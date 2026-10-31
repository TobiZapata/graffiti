import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mostExpensiveWeapon } from '../src/lib/replayEquipment.mjs';

test('selects the priciest visible firearm independently of inventory order', () => {
  assert.equal(mostExpensiveWeapon(['Glock-18', 'AK-47', 'AWP']), 'AWP');
  assert.equal(mostExpensiveWeapon(['AWP', 'AK-47', 'Desert Eagle']), 'AWP');
  assert.equal(mostExpensiveWeapon(['P250', 'Desert Eagle']), 'Desert Eagle');
  assert.equal(mostExpensiveWeapon(['weapon_mac10', 'weapon_glock']), 'weapon_mac10');
});

test('updates after pickups and drops, ignores utility and cosmetic knives, and preserves inputs', () => {
  const inventory = ['Karambit', 'C4 Explosive', 'Incendiary Grenade', 'USP-S'];
  assert.equal(mostExpensiveWeapon(inventory), 'USP-S');
  inventory.push('M4A4');
  assert.equal(mostExpensiveWeapon(inventory), 'M4A4');
  inventory.push('AWP');
  const before = [...inventory];
  assert.equal(mostExpensiveWeapon(inventory), 'AWP');
  assert.deepEqual(inventory, before);
  assert.equal(mostExpensiveWeapon(inventory.filter(w => w !== 'AWP')), 'M4A4');
  assert.equal(mostExpensiveWeapon(['Flashbang', 'Karambit', 'C4']), null);
  assert.equal(mostExpensiveWeapon([]), null);
});
