import test from 'node:test';
import assert from 'node:assert/strict';
import { splitRadarTrail } from '../src/components/splitRadarTrail.mjs';

test('grenade trails split at each Nuke floor transition', () => {
  const trail = [{ z: -495 }, { z: -496 }, { z: -500 }, { z: -494 }];
  assert.deepEqual(splitRadarTrail(trail, { composite: { lowerBelowZ: -495 } }), [trail.slice(0, 1), trail.slice(1, 3), trail.slice(3)]);
  assert.deepEqual(splitRadarTrail(trail, {}), [trail]);
  assert.deepEqual(splitRadarTrail([], {}), []);
});
