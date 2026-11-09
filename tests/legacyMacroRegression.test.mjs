import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { createMacroDirector } from '../src/lib/macroDirector.mjs';

const team = (name, offset) => ({
  id: name, name, mainAwperUid: '0', iglUid: '1', iglCompatibility: offset ? -0.3 : 0.4,
  players: Array.from({ length: 5 }, (_, i) => ({
    uid: String(i), name: name + i, aim: 60 + i * 7 + offset,
    positioning: 85 - i * 5, composure: 77, gamesense: 70 + i * 3, clutch: 80,
  })),
});

test('legacy macro plans and full round sequences retain their pre-v2 RNG', () => {
  const digest = createHash('sha256');
  for (let seed = 0; seed < 100; seed++) {
    const director = createMacroDirector(team('A', 0), team('B', 3), seed, 2), rounds = [];
    while (!director.done && rounds.length < 1000) rounds.push(director.next());
    assert.ok(director.done, `Legacy match did not finish: ${seed}`);
    digest.update(JSON.stringify({ plan: director.plan, rounds }) + '\n');
  }
  // Generated from the pre-v2 engine: old saves and reconstructed summaries depend on this sequence.
  assert.equal(digest.digest('hex'), '5689aa99646291ade0606612cdc102b97c97a5a50fe720830e80e3e4afeb3f6d');
});
