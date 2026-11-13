import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { test } from 'node:test';
import { readReplayJSON } from '../src/lib/readReplayJSON.mjs';

test('uses the configured round bank root only for round bank paths', async t => {
  const original = process.env.NEXT_PUBLIC_ROUND_BANK_BASE_URL;
  t.after(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_ROUND_BANK_BASE_URL;
    else process.env.NEXT_PUBLIC_ROUND_BANK_BASE_URL = original;
  });
  const urls = [];
  t.mock.method(globalThis, 'fetch', async url => {
    urls.push(url);
    return new Response(gzipSync('{"ok":true}'));
  });
  process.env.NEXT_PUBLIC_ROUND_BANK_BASE_URL = '';
  assert.deepEqual(await readReplayJSON('/round-bank/economy-index.json'), { ok: true });
  process.env.NEXT_PUBLIC_ROUND_BANK_BASE_URL = 'https://cdn.example/bank/';
  await readReplayJSON('/round-bank/demos/demo/r1.json.gz');
  await readReplayJSON('/round-bank-lab/r1.json');
  await readReplayJSON('https://example.com/other.json');
  assert.deepEqual(urls, [
    '/round-bank/economy-index.json',
    'https://cdn.example/bank/demos/demo/r1.json.gz',
    '/round-bank-lab/r1.json',
    'https://example.com/other.json',
  ]);
});

test('reads plain JSON, gzip assets and responses already decompressed by the host', async t => {
  const value = { weapon: 'SSG 08', actor: '76561198000000001' };
  for (const bytes of [Buffer.from(JSON.stringify(value)), gzipSync(JSON.stringify(value))]) {
    t.mock.method(globalThis, 'fetch', async () => new Response(bytes));
    assert.deepEqual(await readReplayJSON('/round.json.gz'), value);
    t.mock.restoreAll();
  }
});

test('Dust2 uses its own root for the index, replays, metrics and resolutions', async t => {
  const original = process.env.NEXT_PUBLIC_ROUND_BANK_DUST2_BASE_URL;
  const mirage = process.env.NEXT_PUBLIC_ROUND_BANK_BASE_URL;
  t.after(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_ROUND_BANK_DUST2_BASE_URL;
    else process.env.NEXT_PUBLIC_ROUND_BANK_DUST2_BASE_URL = original;
    if (mirage === undefined) delete process.env.NEXT_PUBLIC_ROUND_BANK_BASE_URL;
    else process.env.NEXT_PUBLIC_ROUND_BANK_BASE_URL = mirage;
  });
  const urls = [];
  t.mock.method(globalThis, 'fetch', async url => {
    urls.push(url);
    return new Response('{"ok":true}');
  });
  process.env.NEXT_PUBLIC_ROUND_BANK_DUST2_BASE_URL = '';
  process.env.NEXT_PUBLIC_ROUND_BANK_BASE_URL = 'https://cdn.example/mirage';
  await readReplayJSON('/round-bank-dust2/economy-index.json');
  process.env.NEXT_PUBLIC_ROUND_BANK_DUST2_BASE_URL = 'https://cdn.example/dust2/v1.0.0/';
  for (const file of ['economy-index.json', 'demos/demo/r1.json.gz', 'round-metrics-v1.json.gz', 'round-resolution-v1.json.gz']) {
    await readReplayJSON(`/round-bank-dust2/${file}`);
  }
  await readReplayJSON('/round-bank/economy-index.json');
  await readReplayJSON('/round-bank-lab/r1.json');
  assert.deepEqual(urls, ['/round-bank-dust2/economy-index.json',
    'https://cdn.example/dust2/v1.0.0/economy-index.json',
    'https://cdn.example/dust2/v1.0.0/demos/demo/r1.json.gz',
    'https://cdn.example/dust2/v1.0.0/round-metrics-v1.json.gz',
    'https://cdn.example/dust2/v1.0.0/round-resolution-v1.json.gz',
    'https://cdn.example/mirage/economy-index.json', '/round-bank-lab/r1.json']);
});

test('production defaults use the published immutable banks without environment overrides', async t => {
  for (const key of ['NEXT_PUBLIC_ROUND_BANK_BASE_URL', 'NEXT_PUBLIC_ROUND_BANK_DUST2_BASE_URL']) {
    const original = process.env[key];
    t.after(() => { if (original === undefined) delete process.env[key]; else process.env[key] = original; });
    delete process.env[key];
  }
  const urls = [];
  t.mock.method(globalThis, 'fetch', async url => { urls.push(url); return new Response('{}'); });
  await readReplayJSON('/round-bank/economy-index.json');
  await readReplayJSON('/round-bank-dust2/economy-index.json');
  assert.deepEqual(urls, [
    'https://tobizapata.github.io/major-rounds-mirage/v1.0.0/economy-index.json',
    'https://tobizapata.github.io/major-rounds-dust2/v1.0.0/economy-index.json',
  ]);
});

test('reports HTTP failures, invalid JSON, corrupt gzip and passes cancellation to fetch', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('missing', { status: 404 }));
  await assert.rejects(readReplayJSON('/missing'), /404/);
  t.mock.restoreAll();
  t.mock.method(globalThis, 'fetch', async () => new Response('broken'));
  await assert.rejects(readReplayJSON('/broken'), SyntaxError);
  t.mock.restoreAll();
  t.mock.method(globalThis, 'fetch', async () => new Response(new Uint8Array([0x1f, 0x8b, 0])));
  await assert.rejects(readReplayJSON('/corrupt.gz'));
  t.mock.restoreAll();
  const controller = new AbortController(); controller.abort();
  t.mock.method(globalThis, 'fetch', async (url, options) => { options.signal.throwIfAborted(); });
  await assert.rejects(readReplayJSON('/abort', controller.signal), { name: 'AbortError' });
});

test('Nuke uses its pinned bank for index, replay, metrics and resolution', async t => {
  const original = process.env.NEXT_PUBLIC_ROUND_BANK_NUKE_BASE_URL;
  t.after(() => { if (original === undefined) delete process.env.NEXT_PUBLIC_ROUND_BANK_NUKE_BASE_URL; else process.env.NEXT_PUBLIC_ROUND_BANK_NUKE_BASE_URL = original; });
  delete process.env.NEXT_PUBLIC_ROUND_BANK_NUKE_BASE_URL;
  const urls = [];
  t.mock.method(globalThis, 'fetch', async url => { urls.push(url); return new Response('{}'); });
  for (const file of ['economy-index.json', 'demos/demo/r1.json.gz', 'round-metrics-v1.json.gz', 'round-resolution-v1.json.gz']) await readReplayJSON('/round-bank-nuke/' + file);
  assert.deepEqual(urls, ['economy-index.json', 'demos/demo/r1.json.gz', 'round-metrics-v1.json.gz', 'round-resolution-v1.json.gz'].map(file => 'https://tobizapata.github.io/major-rounds-nuke/v1.0.0/' + file));
  process.env.NEXT_PUBLIC_ROUND_BANK_NUKE_BASE_URL = '';
  await readReplayJSON('/round-bank-nuke/economy-index.json');
  assert.equal(urls.at(-1), '/round-bank-nuke/economy-index.json');
});
