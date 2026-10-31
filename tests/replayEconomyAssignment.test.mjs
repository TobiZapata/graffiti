import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildWeaponAppearance } from '../src/lib/weaponAppearance.mjs';

test('hidden kit flags do not restrict weapon assignments', () => {
  const metadata = { equipment: { actors: { a: { initialInventory: ['AWP', 'USP-S'], initialHasKit: true } } } };
  const state = { A: { players: [{ uid: 'A:4', inventory: ['AWP', 'USP-S'], hasKit: false }] }, B: { players: [] } };
  const assignments = [{ actorId: 'a', playerUid: 'A:4' }];
  const result = buildWeaponAppearance(metadata, assignments, state);
  assert.deepEqual(result, { a: { AWP: 'AWP', USP: 'USP' } });
  metadata.equipment.actors.a.initialHasKit = false;
  state.A.players[0].hasKit = true;
  assert.deepEqual(buildWeaponAppearance(metadata, assignments, state), result);
});
