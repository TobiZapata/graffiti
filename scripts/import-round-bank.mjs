import { createHash, randomUUID } from 'node:crypto';
import { copyFile, lstat, mkdir, readFile, link, unlink, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { decodeReplay, sampleReplay } from '../src/lib/roundBankReplay.mjs';
import { inventoryItem, normalizeInventory } from '../src/lib/replayEconomy.mjs';
import { WEAPONS } from '../src/app/engines/WeaponEngine.js';
import { weaponEvidenceFromRaw } from '../src/lib/weaponAppearance.mjs';

async function noLinks(target) {
  const root = path.parse(path.resolve(target)).root;
  let current = root;
  for (const part of path.resolve(target).slice(root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    try {
      if ((await lstat(current)).isSymbolicLink()) throw new Error(`Enlace simbólico no permitido: ${current}`);
    } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }
  }
}

async function existingMatches(filename, expected) {
  await noLinks(filename);
  try {
    if (!(await readFile(filename)).equals(expected)) throw new Error(`Contenido distinto en ${filename}; usar un destino nuevo`);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

function validateRound(raw, metadata) {
  const round = decodeReplay(raw, metadata);
  const state = sampleReplay(round, round.duration);
  const deaths = state.events.filter(event => event.type === 'player_death');
  const kills = deaths.filter(event => round.sides[event.attacker] && round.sides[event.victim] &&
    round.sides[event.victim] !== round.sides[event.attacker] && !['c4', 'planted_c4'].includes(event.weapon));
  for (const actor of metadata.actors) {
    const player = state.players.find(item => item.id === actor.actor_id);
    const assists = kills.filter(event => event.assister === actor.actor_id);
    if (player.alive !== actor.survived || kills.filter(event => event.attacker === actor.actor_id).length !== actor.kills ||
        deaths.filter(event => event.victim === actor.actor_id).length !== actor.deaths || assists.length !== actor.assists ||
        assists.filter(event => event.assistedflash).length !== actor.flash_assists) {
      throw new Error(`Metadatos inconsistentes en ${metadata.replay_data_ref}: ${actor.actor_id}`);
    }
  }
  return { raw, round, state, kills };
}

export function equipmentMetadata({ raw, round, state, kills }) {
  const actors = {}, killRewards = {}, killRewardsByWeapon = {};
  for (const opening of round.frames[0].players) {
    const final = state.players.find(player => player.id === opening.id);
    const initialInventory = normalizeInventory(opening.inventory);
    const finalInventory = final.alive ? normalizeInventory(final.inventory) : [];
    if (!initialInventory || !finalInventory) return { supported: false, reason: 'unsupported_inventory' };
    actors[opening.id] = { initialInventory, finalInventory,
      initialHasKit: opening.hasKit, finalHasKit: final.alive && final.hasKit };
  }
  for (const event of kills) {
    const weapon = String(event.weapon).replace(/^weapon_/, '');
    const reward = /^(knife|bayonet)/.test(weapon) ? WEAPONS.KNIFE.killReward : inventoryItem(weapon)?.killReward;
    if (reward === undefined) return { supported: false, reason: `unsupported_kill_weapon:${weapon}` };
    killRewards[event.attacker] = (killRewards[event.attacker] ?? 0) + reward;
    const counts = killRewardsByWeapon[event.attacker] ??= {};
    counts[weapon] = (counts[weapon] ?? 0) + 1;
  }
  return { supported: true, actors, killRewards, killRewardsByWeapon, weaponEvidence: weaponEvidenceFromRaw(raw, round.sides),
    planters: state.events.filter(event => event.type === 'bomb_planted').map(event => event.actor),
    ctKills: kills.filter(event => round.sides[event.attacker] === 'CT').length };
}

async function publishIndex(indexPath, index) {
  const temporary = path.join(path.dirname(indexPath), `.index-${randomUUID()}.tmp`);
  await writeFile(temporary, index, { flag: 'wx' });
  try {
    try { await link(temporary, indexPath); }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      await existingMatches(indexPath, index);
    }
  } finally { await unlink(temporary); }
}

export async function importRoundBank(sourceDir, destDir, map = 'de_mirage') {
  try {
    if (!['de_mirage', 'de_dust2'].includes(map)) throw new Error(`Mapa no soportado: ${map}`);
    const publicPath = map === 'de_dust2' ? '/round-bank-dust2' : '/round-bank';
    await noLinks(sourceDir);
    await noLinks(destDir);
    const catalogPath = path.join(sourceDir, 'catalog.json');
    await noLinks(catalogPath);
    const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
    if (catalog.schema_version !== 1 || !Array.isArray(catalog.rounds)) throw new Error('Catálogo inválido');
    const rounds = catalog.rounds.filter(round => round.eligible === true && round.map === map);
    const seen = new Set();
    for (const round of rounds) {
      if (typeof round.replay_data_ref !== 'string' || !/^demos\/[a-f0-9]{64}\/r[0-9]+\.json$/.test(round.replay_data_ref) || seen.has(round.replay_data_ref)) {
        throw new Error(`Ruta de replay inválida o duplicada: ${round.replay_data_ref}`);
      }
      seen.add(round.replay_data_ref);
    }
    const index = Buffer.from(JSON.stringify({ ...catalog, rounds: rounds.map(round => ({ ...round, replay_data_ref: `${publicPath}/${round.replay_data_ref}.gz` })) }));
    const indexPath = path.join(destDir, 'index.json');
    await existingMatches(indexPath, index);
    const equipmentRounds = [];
    for (const round of rounds) {
      const source = path.join(sourceDir, `${round.replay_data_ref}.gz`);
      const destination = path.join(destDir, `${round.replay_data_ref}.gz`);
      await noLinks(source);
      const compressed = await readFile(source);
      const bytes = gunzipSync(compressed);
      if (createHash('sha256').update(bytes).digest('hex') !== round.replay_sha256) throw new Error(`SHA256 incorrecto: ${round.replay_data_ref}`);
      const evidence = validateRound(JSON.parse(bytes.toString('utf8')), round);
      equipmentRounds.push({ ...round, replay_data_ref: `${publicPath}/${round.replay_data_ref}.gz`, equipment: equipmentMetadata(evidence) });
      await existingMatches(destination, compressed);
    }
    const equipmentIndex = Buffer.from(JSON.stringify({ ...catalog, equipment_version: 2, rounds: equipmentRounds }));
    const equipmentPath = path.join(destDir, 'economy-index.json');
    await existingMatches(equipmentPath, equipmentIndex);
    for (const round of rounds) {
      const source = path.join(sourceDir, `${round.replay_data_ref}.gz`);
      const destination = path.join(destDir, `${round.replay_data_ref}.gz`);
      await noLinks(source);
      await noLinks(destination);
      await mkdir(path.dirname(destination), { recursive: true });
      try { await copyFile(source, destination, constants.COPYFILE_EXCL); }
      catch (error) {
        if (error.code !== 'EEXIST') throw error;
        await existingMatches(destination, await readFile(source));
      }
    }
    await mkdir(destDir, { recursive: true });
    await publishIndex(indexPath, index);
    await publishIndex(equipmentPath, equipmentIndex);
    return rounds.length;
  } catch (error) {
    if (error.code === 'EACCES' || error.code === 'EPERM') throw new Error(`Permiso denegado al importar el banco: ${error.path ?? error.message}`, { cause: error });
    throw error;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const map = process.argv[4] ?? 'de_mirage';
  importRoundBank(process.argv[2] ?? '../cs2-data-lab/output/round-bank', process.argv[3] ?? (map === 'de_dust2' ? 'public/round-bank-dust2' : 'public/round-bank'), map)
    .then(count => console.log(`Importadas ${count} rondas`))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
