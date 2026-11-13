import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { decodeReplay, sampleReplay } from '../src/lib/roundBankReplay.mjs';
import { calculateRoundMetrics } from '../src/lib/matchMetrics.mjs';
import { equipmentMetadata } from './import-round-bank.mjs';

const map = process.argv[2] ?? 'de_mirage';
if (!['de_mirage', 'de_dust2', 'de_nuke'].includes(map)) throw new Error(`Unsupported map: ${map}`);
const bank = map === 'de_mirage' ? 'round-bank' : `round-bank-${map.slice(3)}`;
const bankDir = process.argv[3] ?? `public/${bank}`;
const catalog = JSON.parse(await readFile(`${bankDir}/economy-index.json`, 'utf8'));
const rounds = {};
for (const metadata of catalog.rounds.filter(r => r.eligible && r.equipment?.supported)) {
  if (!new RegExp(`^/${bank}/demos/[a-f0-9]{64}/r\\d+\\.json\\.gz$`).test(metadata.replay_data_ref)) throw new Error('Invalid replay path');
  const bytes = gunzipSync(await readFile(`${bankDir}/${metadata.replay_data_ref.slice(bank.length + 2)}`));
  if (createHash('sha256').update(bytes).digest('hex') !== metadata.replay_sha256) throw new Error(`Replay checksum mismatch: ${metadata.round_id}`);
  const raw = JSON.parse(bytes), round = decodeReplay(raw, metadata), state = sampleReplay(round, raw.resolution_tick / raw.tick_rate);
  const deaths = state.events.filter(event => event.type === 'player_death');
  const kills = deaths.filter(event => round.sides[event.attacker] && round.sides[event.victim] &&
    round.sides[event.victim] !== round.sides[event.attacker] && !['c4', 'planted_c4'].includes(event.weapon));
  const actors = metadata.actors.map(actor => {
    const player = state.players.find(p => p.id === actor.actor_id), assists = kills.filter(e => e.assister === actor.actor_id);
    return { ...actor, survived: player.alive, final_weapon: player.alive ? player.weapon : null,
      kills: kills.filter(e => e.attacker === actor.actor_id).length, deaths: deaths.filter(e => e.victim === actor.actor_id).length,
      assists: assists.length, flash_assists: assists.filter(e => e.assistedflash).length };
  });
  const clipped = { ...raw, end_tick: raw.resolution_tick, events: raw.events.filter(e => e.tick <= raw.resolution_tick),
    inventory_changes: raw.inventory_changes.filter(change => change[0] <= raw.resolution_tick) };
  const equipment = equipmentMetadata({ raw: clipped, round, state, kills });
  if (!equipment.supported) throw new Error(`Unsupported resolution equipment: ${metadata.round_id}`);
  const metrics = calculateRoundMetrics({ ...metadata, actors }, clipped);
  rounds[metadata.round_id] = { sha256: metadata.replay_sha256, actors, equipment,
    metrics: Object.fromEntries(Object.entries(metrics).map(([id, p]) => [id, [p.damage, p.kastRounds, p.swing]])) };
}
const output = gzipSync(JSON.stringify({ version: 1, rounds }), { level: 9 });
await writeFile(process.argv[3] || map !== 'de_mirage' ? `${bankDir}/round-resolution-v1.json.gz` : 'public/round-resolution-v1.json.gz', output);
console.log(`Round resolutions: ${Object.keys(rounds).length} rounds, ${output.length} bytes`);
