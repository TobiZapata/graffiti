function getParticipationWeight(
  player,
) {
  let weight =
    player.aggression * 0.5 +
    player.entry * 0.3 +
    player.aim * 0.2;

  switch (player.role) {
    case "ENTRY":
      weight *= 1.25;
      break;

    case "AWPER":
      weight *= 1.1;
      break;

    case "IGL":
      weight *= 0.85;
      break;

    case "SUPPORT":
      weight *= 0.9;
      break;
  }

  return weight;
}

export function weightedRandomPlayer(
  players,
) {
  const totalWeight = players.reduce(
    (sum, player) =>
      sum +
      getParticipationWeight(player),
    0,
  );

  let random =
    Math.random() * totalWeight;

  for (const player of players) {
    random -=
      getParticipationWeight(player);

    if (random <= 0) {
      return player;
    }
  }

  return players[0];
}
