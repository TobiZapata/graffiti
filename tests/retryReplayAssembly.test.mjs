import assert from 'node:assert/strict';
import { test } from 'node:test';
import { retryReplayAssembly } from '../src/lib/retryReplayAssembly.mjs';

const coverage = () => Object.assign(new Error('Sin cobertura'), { code: 'ROUND_BANK_COVERAGE' });

test('returns the original seed immediately when assembly succeeds', async () => {
  const seeds = [];
  const result = await retryReplayAssembly(seed => { seeds.push(seed); return { seed: 'original', winner: 'A' }; }, 'original');
  assert.deepEqual(seeds, ['original']);
  assert.deepEqual(result, { seed: 'original', winner: 'A', assemblySeed: 'original', retryCount: 0 });
});

test('coverage retries use distinct reproducible seeds and preserve the returned macro plan', async () => {
  const run = async () => {
    const seeds = [], plan = { winnerTeam: 'B', targetScore: { A: 8, B: 13 } };
    const result = await retryReplayAssembly(seed => {
      seeds.push(seed);
      if (seeds.length < 3) throw coverage();
      return { seed: 17, macroPlan: plan };
    }, 17);
    assert.equal(result.macroPlan, plan);
    assert.equal(result.seed, 17);
    assert.equal(result.retryCount, 2);
    assert.equal(result.assemblySeed, seeds[2]);
    assert.equal(new Set(seeds).size, 3);
    return seeds;
  };
  assert.deepEqual(await run(), await run());
});

test('stops after five coverage failures and does not retry other errors', async () => {
  let calls = 0;
  await assert.rejects(retryReplayAssembly(() => { calls++; throw coverage(); }, 'seed'), /after 5 attempts/);
  assert.equal(calls, 5);
  for (const error of [new TypeError('Datos inválidos'), new Error('Error interno')]) {
    calls = 0;
    await assert.rejects(retryReplayAssembly(() => { calls++; throw error; }, 'seed'), received => received === error);
    assert.equal(calls, 1);
  }
});
