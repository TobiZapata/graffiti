import { WEAPONS } from "../../engines/WeaponEngine";

export class Team {
  constructor(name, players) {
    this.name = name;
    this.players = players;

    this.lossBonus = 1;
    this.buyType = "PISTOL";
    this.roundsWon = 0;
    this.weaponPool = []; // armas recuperadas, disponibles gratis la próxima compra
  }

  get totalMoney() {
    return this.players.reduce(
      (sum, p) => sum + p.money,
      0,
    );
  }

  // valor real del equipamiento en cancha (no la plata gastada)
  get equipmentValue() {
    return this.players.reduce(
      (sum, p) =>
        sum +
        (WEAPONS[p.weapon]?.cost ?? 0) +
        (p.utilityValue ?? 0) +
        (p.armorValue ?? 0),
      0,
    );
  }
}
