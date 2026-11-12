import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { gzipSync } from 'node:zlib';
import { importRoundBank } from '../scripts/import-round-bank.mjs';
import { inventoryItem } from '../src/lib/replayEconomy.mjs';

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'round-bank-'));
  const source = path.join(root, 'source'), dest = path.join(root, 'dest');
  const catalog = JSON.parse(await readFile(new URL('../public/round-bank-lab/index.json', import.meta.url)));
  for (const round of catalog.rounds) {
    const raw = await readFile(new URL(`../public${round.replay_data_ref}`, import.meta.url));
    round.replay_data_ref = `demos/${'a'.repeat(64)}/r${round.round}.json`;
    round.replay_sha256 = createHash('sha256').update(raw).digest('hex');
    const target = path.join(source, `${round.replay_data_ref}.gz`);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, gzipSync(raw));
  }
  await writeFile(path.join(source, 'catalog.json'), JSON.stringify(catalog));
  return { root, source, dest, catalog };
}

test('imports eligible rounds and can be repeated without changing files', async () => {
  const { root, source, dest, catalog } = await fixture();
  try {
    assert.equal(await importRoundBank(source, dest), 3);
    assert.equal(await importRoundBank(source, dest), 3);
    const index = JSON.parse(await readFile(path.join(dest, 'index.json')));
    const equipmentIndex = JSON.parse(await readFile(path.join(dest, 'economy-index.json')));
    assert.equal(equipmentIndex.equipment_version, 2);
    assert.equal(equipmentIndex.rounds.length, 3);
    for (const round of equipmentIndex.rounds) {
      assert.equal(round.equipment.supported, true);
      assert.equal(Object.keys(round.equipment.actors).length, 10);
      assert.equal(round.equipment.weaponEvidence.actors.length, 10);
      assert.ok(round.equipment.weaponEvidence.changes.length >= 10);
      assert.equal(Object.values(round.equipment.killRewardsByWeapon).reduce((sum, weapons) => sum + Object.values(weapons).reduce((n, count) => n + count, 0), 0), round.actors.reduce((sum, actor) => sum + actor.kills, 0));
      for (const actor of round.actors) {
        const equipment = round.equipment.actors[actor.actor_id];
        assert.ok(equipment.initialInventory.every(item => inventoryItem(item)));
        if (!actor.survived) {
          assert.deepEqual(equipment.finalInventory, []);
          assert.equal(equipment.finalHasKit, false);
        }
      }
    }
    assert.deepEqual(index.rounds.map(round => round.replay_data_ref), catalog.rounds.map(round => `/round-bank/${round.replay_data_ref}.gz`));
    assert.deepEqual(await readFile(path.join(dest, `${catalog.rounds[0].replay_data_ref}.gz`)), await readFile(path.join(source, `${catalog.rounds[0].replay_data_ref}.gz`)));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('imports only eligible Dust2 rounds into a separate public bank', async () => {
  const { root, source, dest, catalog } = await fixture();
  try {
    catalog.rounds[0].map = 'de_dust2';
    catalog.rounds[1].map = 'de_dust2';
    catalog.rounds[1].eligible = false;
    await writeFile(path.join(source, 'catalog.json'), JSON.stringify(catalog));
    assert.equal(await importRoundBank(source, dest, 'de_dust2'), 1);
    for (const name of ['index.json', 'economy-index.json']) {
      const index = JSON.parse(await readFile(path.join(dest, name)));
      assert.deepEqual(index.rounds.map(round => round.replay_data_ref), [`/round-bank-dust2/${catalog.rounds[0].replay_data_ref}.gz`]);
    }
    await assert.rejects(importRoundBank(source, dest, 'de_unknown'), /Mapa no soportado/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('rejects corruption, traversal and conflicting files without publishing an index', async () => {
  const { root, source, dest, catalog } = await fixture();
  try {
    const original = catalog.rounds[0].replay_data_ref;
    catalog.rounds[0].replay_data_ref = '../escape.json';
    await writeFile(path.join(source, 'catalog.json'), JSON.stringify(catalog));
    await assert.rejects(importRoundBank(source, dest), /Ruta de replay inválida/);
    catalog.rounds[0].replay_data_ref = original;
    catalog.rounds[0].replay_sha256 = '0'.repeat(64);
    await writeFile(path.join(source, 'catalog.json'), JSON.stringify(catalog));
    await assert.rejects(importRoundBank(source, dest), /SHA256/);
    await assert.rejects(readFile(path.join(dest, 'index.json')), { code: 'ENOENT' });
    catalog.rounds[0].replay_sha256 = createHash('sha256').update(await readFile(new URL('../public/round-bank-lab/r001.json', import.meta.url))).digest('hex');
    await writeFile(path.join(source, 'catalog.json'), JSON.stringify(catalog));
    const conflict = path.join(dest, `${original}.gz`);
    await mkdir(path.dirname(conflict), { recursive: true });
    await writeFile(conflict, 'different');
    await assert.rejects(importRoundBank(source, dest), /destino nuevo/);
    await assert.rejects(readFile(path.join(dest, 'index.json')), { code: 'ENOENT' });
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('ignores enemy and self assists but still rejects incorrect credited totals', async () => {
  for (const assister of ['user_steamid', 'attacker_steamid']) {
    const { root, source, dest, catalog } = await fixture();
    try {
      catalog.rounds = catalog.rounds.slice(0, 1);
      const metadata = catalog.rounds[0];
      const raw = JSON.parse(await readFile(new URL('../public/round-bank-lab/r001.json', import.meta.url)));
      for (const event of raw.events.filter(e => e.event === 'player_death')) event.assister_steamid = event[assister];
      for (const actor of metadata.actors) { actor.assists = 0; actor.flash_assists = 0; }
      const bytes = Buffer.from(JSON.stringify(raw));
      metadata.replay_sha256 = createHash('sha256').update(bytes).digest('hex');
      await writeFile(path.join(source, `${metadata.replay_data_ref}.gz`), gzipSync(bytes));
      await writeFile(path.join(source, 'catalog.json'), JSON.stringify(catalog));
      assert.equal(await importRoundBank(source, dest), 1);
      metadata.actors[0].assists = 1;
      await writeFile(path.join(source, 'catalog.json'), JSON.stringify(catalog));
      const rejected = path.join(root, 'rejected');
      await assert.rejects(importRoundBank(source, rejected), /Metadatos inconsistentes/);
      await assert.rejects(readFile(path.join(rejected, 'index.json')), { code: 'ENOENT' });
    } finally { await rm(root, { recursive: true, force: true }); }
  }
});
