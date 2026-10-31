import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { test } from 'node:test';
import { readReplayJSON } from '../src/lib/readReplayJSON.mjs';

test('reads plain JSON, gzip assets and responses already decompressed by the host', async t => {
  const value = { weapon: 'SSG 08', actor: '76561198000000001' };
  for (const bytes of [Buffer.from(JSON.stringify(value)), gzipSync(JSON.stringify(value))]) {
    t.mock.method(globalThis, 'fetch', async () => new Response(bytes));
    assert.deepEqual(await readReplayJSON('/round.json.gz'), value);
    t.mock.restoreAll();
  }
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
