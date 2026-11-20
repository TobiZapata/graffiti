import seedrandom from 'seedrandom';

export const REPLAY_MAPS = {
  de_mirage: { label: 'Mirage', bank: '/round-bank/economy-index.json', metrics: '/round-metrics-v1.json.gz',
    resolution: '/round-resolution-v1.json.gz', originX: -3230, originY: 1713, scale: 5 },
  de_dust2: { label: 'Dust2', bank: '/round-bank-dust2/economy-index.json', metrics: '/round-bank-dust2/round-metrics-v1.json.gz',
    resolution: '/round-bank-dust2/round-resolution-v1.json.gz', originX: -2476, originY: 3239, scale: 4.4 },
  de_nuke: { label: 'Nuke', bank: '/round-bank-nuke/economy-index.json', metrics: '/round-bank-nuke/round-metrics-v1.json.gz',
    resolution: '/round-bank-nuke/round-resolution-v1.json.gz', originX: -3453, originY: 2887, scale: 7,
    composite: { lowerBelowZ: -495, upper: { x: -16, y: -248 }, lower: { x: -112, y: 288 } } },
  de_anubis: { label: 'Anubis', bank: '/round-bank-anubis/economy-index.json', metrics: '/round-bank-anubis/round-metrics-v1.json.gz',
    resolution: '/round-bank-anubis/round-resolution-v1.json.gz', originX: -2796, originY: 3328, scale: 5.22 },
  de_cache: { label: 'Cache', bank: '/round-bank-cache/economy-index.json', metrics: '/round-bank-cache/round-metrics-v1.json.gz',
    resolution: '/round-bank-cache/round-resolution-v1.json.gz', originX: -2000, originY: 3250, scale: 5.5 },
  de_inferno: { label: 'Inferno', bank: '/round-bank-inferno/economy-index.json', metrics: '/round-bank-inferno/round-metrics-v1.json.gz',
    resolution: '/round-bank-inferno/round-resolution-v1.json.gz', originX: -2087, originY: 3870, scale: 4.9 },
  de_ancient: { label: 'Ancient', bank: '/round-bank-ancient/economy-index.json', metrics: '/round-bank-ancient/round-metrics-v1.json.gz',
    resolution: '/round-bank-ancient/round-resolution-v1.json.gz', originX: -2953, originY: 2164, scale: 5 },
};

export function selectReplayMap(tournamentId, matchId) {
  const maps = Object.keys(REPLAY_MAPS);
  return maps[Math.floor(seedrandom(`${tournamentId}:${matchId}:map-selection`)() * maps.length)];
}
