export function clutchDuel(
  clutcher,
  opponents,
) {
  const clutchPower =
    clutcher.clutchRating;

  const opponentsPower =
    opponents.reduce(
      (sum, player) =>
        sum + player.duelRating,
      0,
    );

  const chance =
    clutchPower /
    (clutchPower + opponentsPower);

  return Math.random() < chance;
}
