export class Player {
  constructor(data) {
    this.name = data.name;
    this.role = data.role;

    this.aim = data.aim;
    this.gamesense = data.gamesense;
    this.positioning = data.positioning;
    this.utility = data.utility;
    this.clutch = data.clutch;
    this.entry = data.entry;
    this.aggression = data.aggression;
    this.composure = data.composure;

    this.kills = 0;
    this.deaths = 0;

    this.money = 800;
    this.weapon = "KNIFE";
    this.armorValue = 0;
    this.utilityValue = 0; // valor en $ de la utilidad cargada esta ronda
    this.isAwper =
      data.isAwper ??
      data.role === "AWPER";
  }

  get duelRating() {
    return (
      this.aim * 0.5 +
      this.positioning * 0.3 +
      this.composure * 0.2
    );
  }

  get entryRating() {
    return (
      this.entry * 0.5 +
      this.aim * 0.3 +
      this.aggression * 0.2
    );
  }

  get clutchRating() {
    return (
      this.clutch * 0.5 +
      this.composure * 0.3 +
      this.gamesense * 0.2
    );
  }

  // determina quién se lleva el AWP del equipo, no solo el rol
  get awpSkill() {
    return (
      this.aim * 0.6 +
      this.gamesense * 0.25 +
      this.composure * 0.15
    );
  }

  get awpPriority() {
    return (
      this.awpSkill +
      (this.isAwper ? 150 : 0)
    );
  }
}
