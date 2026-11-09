import test from 'node:test';
import assert from 'node:assert/strict';
import { CURRENT_SIMULATION, assertCompatibleSimulation, simulationEngineVersion } from '../src/lib/simulationVersion.mjs';

test('new Majors use v3 while saved v2 and descriptor-free Majors keep v2', () => {
  assert.equal(CURRENT_SIMULATION.engineVersion, 3);
  assert.equal(simulationEngineVersion(CURRENT_SIMULATION), 3);
  assert.equal(simulationEngineVersion({ ...CURRENT_SIMULATION, engineVersion: 2 }), 2);
  assert.equal(simulationEngineVersion(null), 2);
  assert.equal(simulationEngineVersion(undefined), 2);
});

test('unsupported engines, data, banks and descriptor extensions are rejected', () => {
  for (const value of [
    { ...CURRENT_SIMULATION, engineVersion: 999 },
    { ...CURRENT_SIMULATION, engineVersion: '3' },
    { ...CURRENT_SIMULATION, playerDataVersion: 'unknown' },
    { ...CURRENT_SIMULATION, bankVersion: 'unknown' },
    { ...CURRENT_SIMULATION, url: 'https://example.org' },
    { engineVersion: 3 },
  ]) assert.throws(() => assertCompatibleSimulation(value), /unsupported/);
});
