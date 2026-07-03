import { WEAPONS } from "../engines/WeaponEngine";

export function weightedDuel(
  playerA,
  playerB,
) {
  const modifierA =
    Math.random() * 10 - 5;
  const modifierB =
    Math.random() * 10 - 5;

  const powerA =
    playerA.duelRating +
    modifierA +
    (WEAPONS[playerA.weapon]?.power ??
      0) *
      0.4;

  const powerB =
    playerB.duelRating +
    modifierB +
    (WEAPONS[playerB.weapon]?.power ??
      0) *
      0.4;

  const chanceA =
    powerA / (powerA + powerB);
  return Math.random() < chanceA ?
      playerA
    : playerB;
}
