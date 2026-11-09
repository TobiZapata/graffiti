export const PLAYER_SCORES = Object.freeze(['awp', 'rifler', 'igl', 'firepower', 'clutch']);

// Legacy players already have clutch, so it cannot identify the new model.
export const isV2Player = player => !!player && ['awp', 'rifler', 'igl', 'firepower'].some(key => Object.hasOwn(player, key));

export function validateV2Player(player) {
  for (const key of PLAYER_SCORES) {
    if (!Number.isInteger(player?.[key]) || player[key] < 0 || player[key] > 100) {
      throw new Error(`Invalid player score: ${key}`);
    }
  }
}
