import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { calculateRoundMetrics } from '../src/lib/matchMetrics.mjs';

const catalog = JSON.parse(await readFile('public/round-bank/economy-index.json', 'utf8'));
const rounds = {};
for (const round of catalog.rounds.filter(r => r.eligible && r.equipment?.supported)) {
  if (!/^\/round-bank\/demos\/[a-f0-9]{64}\/r\d+\.json\.gz$/.test(round.replay_data_ref)) throw new Error('Invalid replay path');
  const bytes = gunzipSync(await readFile(`public${round.replay_data_ref}`));
  if (createHash('sha256').update(bytes).digest('hex') !== round.replay_sha256) throw new Error(`Replay checksum mismatch: ${round.round_id}`);
  const metrics = calculateRoundMetrics(round, JSON.parse(bytes));
  rounds[round.round_id] = { sha256: round.replay_sha256,
    actors: Object.fromEntries(Object.entries(metrics).map(([id, p]) => [id, [p.damage, p.kastRounds, p.swing]])) };
}
const output = gzipSync(JSON.stringify({ version: 1, rounds }), { level: 9 });
await writeFile('public/round-metrics-v1.json.gz', output);
console.log(`Round metrics: ${Object.keys(rounds).length} rounds, ${output.length} bytes`);
