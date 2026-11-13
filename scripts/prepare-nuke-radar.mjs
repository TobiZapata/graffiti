import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const directory = new URL('../public/maps/nuke/', import.meta.url);
// Keep world-to-image registration; only translate each floor into the composite.
const layout = {
  width: 1024, height: 1088, originX: -3453, originY: 2887, scale: 7,
  lowerBelowZ: -495,
  upper: { crop: { left: 48, top: 272, width: 960, height: 512 }, left: 32, top: 24 },
  lower: { crop: { left: 488, top: 272, width: 264, height: 512 }, left: 376, top: 560 },
  // shortcut: mask checked against the current bank; recheck when adding Nuke demos.
  lowerPolygon: [[560,280],[608,280],[608,310],[635,310],[635,449],[700,449],
    [704,575],[677,575],[677,640],[735,640],[735,770],[669,770],[669,701],
    [643,701],[643,660],[490,660],[490,630],[505,630],[505,585],[533,585],[533,450],[535,450],
    [535,310],[560,310]],
};
const mask = Buffer.from(`<svg width="1024" height="1024"><polygon fill="white" points="${layout.lowerPolygon.map(p => p.join(',')).join(' ')}"/></svg>`);
const upper = await sharp(fileURLToPath(new URL('de_nuke_radar_psd.png', directory)))
  .extract(layout.upper.crop).png().toBuffer();
const lowerFull = await sharp(fileURLToPath(new URL('de_nuke_lower_radar_psd.png', directory)))
  .composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
const lower = await sharp(lowerFull).extract(layout.lower.crop).png().toBuffer();
const output = new URL('de_nuke_composite_radar.webp', directory);
await sharp({ create: { width: layout.width, height: layout.height, channels: 4, background: '#00000000' } })
  .composite([{ input: upper, left: layout.upper.left, top: layout.upper.top },
    { input: lower, left: layout.lower.left, top: layout.lower.top }])
  .webp({ lossless: true, effort: 6 }).toFile(fileURLToPath(output));
await writeFile(new URL('de_nuke_composite_radar.json', directory), JSON.stringify(layout, null, 2) + '\n');

// Pass exported rounds or their demos directory to check real lower-floor samples.
if (process.argv[2]) {
  const { data, info } = await sharp(lowerFull).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let checked = 0;
  const paths = [];
  for (const input of process.argv.slice(2)) {
    if (input.endsWith('.json')) paths.push(input);
    else paths.push(...(await readdir(input, { recursive: true })).filter(name => /\br\d+\.json$/.test(name)).map(name => join(input, name)));
  }
  for (const path of paths) {
    const replay = JSON.parse(await readFile(path, 'utf8'));
    assert.deepEqual(replay.frame_columns.slice(0, 6), ['x', 'y', 'z', 'yaw', 'health', 'alive']);
    for (const [, players] of replay.frames) for (const p of players) {
      if (!p[5] || p[2] >= layout.lowerBelowZ) continue;
      const x = Math.round((p[0] - layout.originX) / layout.scale);
      const y = Math.round((layout.originY - p[1]) / layout.scale);
      assert(x >= 0 && x < info.width && y >= 0 && y < info.height);
      assert(data[(y * info.width + x) * 4 + 3] > 0, `Lower mask clips position ${x},${y}`);
      checked++;
    }
  }
  assert(checked > 0, 'No lower-floor samples to validate');
  console.log(`Validated ${checked} live lower-floor positions`);
}
assert.equal((await sharp(fileURLToPath(output)).metadata()).height, layout.height);
console.log(fileURLToPath(output));
