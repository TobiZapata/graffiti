export const CURRENT_SIMULATION = Object.freeze({
  engineVersion: 3,
  playerDataVersion: 'players-v2.0.0',
  bankVersion: 'mirage-economy-v2',
});

export function assertCompatibleSimulation(value) {
  if (value == null) return;
  if (Object.keys(value).length !== 3 || ![2, 3].includes(value.engineVersion) ||
      !['mirage-economy-v1', 'mirage-economy-v2'].includes(value.bankVersion) ||
      value.playerDataVersion !== CURRENT_SIMULATION.playerDataVersion) {
    throw new Error('This Major uses an unsupported simulation version. Update the app to continue.');
  }
}

export function simulationEngineVersion(value) {
  assertCompatibleSimulation(value);
  return value?.engineVersion ?? 2;
}
