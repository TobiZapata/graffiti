import seedrandom from 'seedrandom';

export const REPLAY_MAPS = {
  de_mirage: { label: 'Mirage', bank: '/round-bank/economy-index.json', metrics: '/round-metrics-v1.json.gz',
    resolution: '/round-resolution-v1.json.gz', originX: -3230, originY: 1713, scale: 5 },
  de_dust2: { label: 'Dust2', bank: '/round-bank-dust2/economy-index.json', metrics: '/round-bank-dust2/round-metrics-v1.json.gz',
    resolution: '/round-bank-dust2/round-resolution-v1.json.gz', originX: -2476, originY: 3239, scale: 4.4 },
};

export function selectReplayMap(tournamentId, matchId) {
  return seedrandom(`${tournamentId}:${matchId}:map-selection`)() < 0.5 ? 'de_mirage' : 'de_dust2';
}
