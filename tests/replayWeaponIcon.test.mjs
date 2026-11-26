import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { WEAPONS } from '../src/app/engines/WeaponEngine.js';
import { cachedWeaponIcon, replayKnifeSkins, replayWeaponIcon } from '../src/lib/replayWeaponIcon.mjs';
import { isKnife } from '../src/lib/replayEquipment.mjs';
import nextConfig from '../next.config.mjs';

test('weapon cache URLs match the content version required by the cache headers', async () => {
  const previous = process.env.NEXT_PUBLIC_WEAPON_ASSET_VERSION;
  try {
    process.env.NEXT_PUBLIC_WEAPON_ASSET_VERSION = nextConfig.env.NEXT_PUBLIC_WEAPON_ASSET_VERSION;
    const [rule] = await nextConfig.headers();
    const version = rule.has[0].value;
    assert.match(version, /^[a-f0-9]{16}$/);
    assert.equal(cachedWeaponIcon('/weapons/other/c4.svg'), `/weapons/other/c4.svg?v=${version}`);
    assert.equal(rule.headers[0].value, 'public, max-age=31536000, immutable');
    assert.equal(cachedWeaponIcon('/modifiers/trophy.svg'), '/modifiers/trophy.svg');
    assert.equal(cachedWeaponIcon(null), null);
    delete process.env.NEXT_PUBLIC_WEAPON_ASSET_VERSION;
    assert.equal(cachedWeaponIcon('/weapons/other/c4.svg'), '/weapons/other/c4.svg');
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_WEAPON_ASSET_VERSION;
    else process.env.NEXT_PUBLIC_WEAPON_ASSET_VERSION = previous;
  }
});

test('weapons and native killfeed aliases resolve to existing SVG assets', () => {
  for (const weapon of Object.values(WEAPONS).filter(w => w.id !== 'KNIFE')) {
    const icon = replayWeaponIcon(weapon.id);
    assert.ok(icon && existsSync(new URL(`../public${icon}`, import.meta.url)), weapon.id);
  }
  for (const [weapon, path] of [
    ['AK-47', 'rifles_smg/ak47'], ['weapon_m4a1_silencer', 'rifles_smg/m4a1_silencer'], ['m4a1', 'rifles_smg/m4a1'],
    ['Dual Berettas', 'pistols/elite'], ['weapon_elite', 'pistols/elite'], ['High Explosive Grenade', 'other/hegrenade'],
    ['weapon_knife_m9_bayonet', 'knifes/knife_m9_bayonet'], ['M9 Bayonet', 'knifes/knife_m9_bayonet'],
    ['Butterfly Knife', 'knifes/knife_butterfly'], ['Karambit', 'knifes/knife_karambit'],
    ['Skeleton Knife', 'knifes/knife_skeleton'], ['Huntsman Knife', 'knifes/knife_tactical'],
    ['Talon Knife', 'knifes/knife_widowmaker'], ['Survival Knife', 'knifes/knife_canis'],
    ['Falchion Knife', 'knifes/knife_falchion'], ['Stiletto Knife', 'knifes/knife_stiletto'],
    ['Flip Knife', 'knifes/knife_flip'], ['knife', 'knifes/knife'], ['knife_t', 'knifes/knife_t'],
    ['weapon_knife_tactical', 'knifes/knife_tactical'], ['weapon_knife_canis', 'knifes/knife_canis'],
    ['C4 Explosive', 'other/c4'], ['planted_c4', 'other/planted_c4'], ['inferno', 'other/inferno'],
    ['Flashbang', 'other/flashbang'], ['Decoy Grenade', 'other/decoy'], ['Molotov', 'other/molotov'],
    ['Incendiary Grenade', 'other/incgrenade'], ['Zeus x27', 'other/taser'],
    ['Smoke Grenade', 'other/smokegrenade'], ['SMOKE', 'other/smokegrenade'],
    ['smokegrenade', 'other/smokegrenade'], ['weapon_smokegrenade', 'other/smokegrenade'],
  ]) {
    assert.equal(replayWeaponIcon(weapon), `/weapons/${path}.svg`);
    assert.ok(existsSync(new URL(`../public/weapons/${path}.svg`, import.meta.url)));
  }
});

test('each cosmetic knife SVG occurs once in the pool and resolves by its weapon ID', () => {
  const assets = readdirSync(new URL('../public/weapons/knifes/', import.meta.url))
    .filter(asset => asset.endsWith('.svg') && !['knife.svg', 'knife_t.svg'].includes(asset))
    .map(asset => asset.slice(0, -4)).sort();
  assert.deepEqual([...replayKnifeSkins].sort(), assets);
  for (const id of replayKnifeSkins) {
    assert.equal(replayWeaponIcon(id), `/weapons/knifes/${id}.svg`);
    assert.equal(replayWeaponIcon(`weapon_${id}`), replayWeaponIcon(id));
    assert.ok(isKnife(id));
  }
});

test('additional knife display names and demo aliases resolve to their cosmetic SVGs', () => {
  for (const [id, ...aliases] of [
    ['bayonet', 'Bayonet', 'knife_bayonet'],
    ['knife_bowie', 'Bowie Knife', 'knife_survival_bowie'],
    ['knife_cord', 'Paracord Knife'],
    ['knife_css', 'Classic Knife'],
    ['knife_gut', 'Gut Knife'],
    ['knife_gypsy_jackknife', 'Navaja Knife'],
    ['knife_kukri', 'Kukri Knife'],
    ['knife_outdoor', 'Nomad Knife'],
    ['knife_push', 'Shadow Daggers'],
    ['knife_ursus', 'Ursus Knife'],
  ]) {
    for (const alias of aliases) {
      assert.equal(replayWeaponIcon(alias), `/weapons/knifes/${id}.svg`);
      assert.equal(replayWeaponIcon(`weapon_${alias}`), replayWeaponIcon(alias));
      assert.ok(isKnife(alias));
    }
  }
});

test('missing weapons keep text rather than substituting another gun or knife', () => {
  for (const name of ['P2000', 'hkp2000', 'MP7', 'Unknown Knife', '', null]) {
    assert.equal(replayWeaponIcon(name), null);
  }
});
