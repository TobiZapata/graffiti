export const CURRENT_SIMULATION = Object.freeze({
  engineVersion: 3,
  playerDataVersion: 'players-v2.0.0',
  bankVersion: 'mirage-economy-v1',
});

export function assertCompatibleSimulation(value) {
  if (value == null) return;
  if (Object.keys(value).length !== 3 || ![2, 3].includes(value.engineVersion) ||
      Object.entries(CURRENT_SIMULATION).some(([key, expected]) => key !== 'engineVersion' && value[key] !== expected)) {
    throw new Error('This Major uses an unsupported simulation version. Update the app to continue.');
  }
}

export function simulationEngineVersion(value) {
  assertCompatibleSimulation(value);
  return value?.engineVersion ?? 2;
}
