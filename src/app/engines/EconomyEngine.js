import {
  WEAPONS,
  getDefaultPistol,
  isUpgrade,
  weaponPower,
} from "./WeaponEngine";

export const ARMOR = {
  KEVLAR: {
    id: "KEVLAR",
    name: "Chaleco",
    cost: 650,
  },
  KEVLAR_HELMET: {
    id: "KEVLAR_HELMET",
    name: "Chaleco + Casco",
    cost: 1000,
  },
};

const ARMOR_BUY_CHANCE = {
  PISTOL: 0.65,
  ECO: 0.05,
  FORCE: 0.7,
  FULL: 0.95,
  FULL_DUMP: 0.95,
};

const LOSS_BONUS_TABLE = [
  1400, 1900, 2400, 2900, 3400,
];
const WIN_REWARD = 3250;
const PLANT_BONUS = 300;
const MAX_MONEY = 16000;
const ROUNDS_PER_HALF = 12;
const FULL_BUY_THRESHOLD = 3700;
const CT_KILL_BONUS = 50;

const RIFLES_AND_SNIPERS = new Set([
  "AK47",
  "M4A1S",
  "M4A4",
  "GALIL",
  "FAMAS",
  "AWP",
  "SSG08",
]);

function isRifleOrSniper(weaponId) {
  return RIFLES_AND_SNIPERS.has(
    weaponId,
  );
}

export function isPistolRound(
  roundNumber,
) {
  if (
    roundNumber === 1 ||
    roundNumber === 13
  )
    return true;
  return false;
}

export function isLastRoundOfHalf(
  roundNumber,
) {
  return (
    roundNumber === ROUNDS_PER_HALF ||
    roundNumber === ROUNDS_PER_HALF * 2
  );
}

function effectiveBuyPower(team) {
  const heldGearValue =
    team.players.reduce(
      (sum, p) =>
        sum +
        (isRifleOrSniper(p.weapon) ?
          (WEAPONS[p.weapon]?.cost ?? 0)
        : 0),
      0,
    );
  const poolValue =
    team.weaponPool.reduce(
      (sum, w) =>
        sum + (WEAPONS[w]?.cost ?? 0),
      0,
    );
  return (
    (team.totalMoney +
      heldGearValue +
      poolValue) /
    team.players.length
  );
}

export function decideTeamStrategy(
  team,
  roundNumber,
) {
  if (isPistolRound(roundNumber)) {
    team.buyType = "PISTOL";
    return team.buyType;
  }

  if (
    roundNumber === 2 ||
    roundNumber === 14
  ) {
    if (team.lossBonus === 1) {
      team.buyType = "FORCE";
      return team.buyType;
    }
  }

  if (isLastRoundOfHalf(roundNumber)) {
    team.buyType = "FULL_DUMP";
    return team.buyType;
  }

  const buyPower =
    effectiveBuyPower(team);

  if (buyPower >= FULL_BUY_THRESHOLD) {
    team.buyType = "FULL";
    return team.buyType;
  }

  // Peor caso: perdemos esta ronda. ¿El cash que nos queda
  // (después de gastar lo mínimo en pistola) más el loss bonus
  // alcanza para un full buy real la próxima?
  const avgMoney =
    team.totalMoney /
    team.players.length;
  const moneyAfterEco = avgMoney - 200;
  const expectedLossBonus =
    LOSS_BONUS_TABLE[
      Math.min(team.lossBonus - 1, 4)
    ];
  const projectedAfterEco =
    moneyAfterEco + expectedLossBonus;

  if (
    projectedAfterEco >=
    FULL_BUY_THRESHOLD
  ) {
    team.buyType = "ECO";
    return team.buyType;
  }

  team.buyType = "FORCE";
  return team.buyType;
}

function tryBuy(
  player,
  weaponId,
  side,
) {
  const weapon = WEAPONS[weaponId];
  if (!weapon) return false;
  if (
    weapon.side !== "BOTH" &&
    weapon.side !== side
  )
    return false;
  if (player.money >= weapon.cost) {
    player.money -= weapon.cost;
    player.weapon = weaponId;
    return true;
  }
  return false;
}

// Antes de comprar: reparte las armas recuperadas del pool del equipo.
// Respeta el bando del arma (un AK47 del medio tiempo anterior no sirve si ahora sos CT)
// y nunca asigna un segundo AWP.
function absorbWeaponPool(team, side) {
  if (team.weaponPool.length === 0)
    return;

  const pool = [
    ...team.weaponPool,
  ].sort(
    (a, b) =>
      weaponPower(b) - weaponPower(a),
  );
  const remainingPool = [];

  pool.forEach((weaponId) => {
    const weapon = WEAPONS[weaponId];
    if (!weapon) return;
    if (
      weapon.side !== "BOTH" &&
      weapon.side !== side
    )
      return;

    if (
      weaponId === "AWP" &&
      team.players.some(
        (p) => p.weapon === "AWP",
      )
    ) {
      return;
    }

    const eligible = team.players
      .filter((p) =>
        isUpgrade(p.weapon, weaponId),
      )
      .sort((a, b) =>
        weaponId === "AWP" ?
          b.awpPriority - a.awpPriority
        : weaponPower(a.weapon) -
          weaponPower(b.weapon),
      );

    if (eligible.length > 0) {
      eligible[0].weapon = weaponId;
    } else {
      remainingPool.push(weaponId);
    }
  });

  team.weaponPool = remainingPool.slice(
    0,
    team.players.length,
  );
}

const UTILITY_SPEND_RATIO = {
  PISTOL: [0.6, 1.0],
  ECO: [0, 0.25], // eco real: se guarda la plata a propósito
  FORCE: [0.5, 0.9],
  FULL: [0.7, 1.0],
  FULL_DUMP: [0.9, 1.0],
};

function roundToNearest50(value) {
  return Math.round(value / 50) * 50;
}
const MAX_UTILITY = {
  T: 1400,
  CT: 1800,
}; // cap grenades + kit CT
function buyUtility(
  player,
  strategy,
  side,
) {
  const [min, max] =
    UTILITY_SPEND_RATIO[strategy] || [
      0, 0,
    ];
  const ratio =
    min + Math.random() * (max - min);

  let budget = player.money * ratio;
  if (player.role === "SUPPORT") {
    budget = Math.min(
      player.money,
      budget * 1.2,
    );
  }
  const cap = MAX_UTILITY[side] ?? 1400;
  budget = Math.min(budget, cap);
  budget = roundToNearest50(budget);
  budget = Math.max(
    0,
    Math.min(budget, player.money),
  );

  player.money -= budget;
  player.utilityValue = budget;
}

function buyMainWeapon(
  player,
  strategy,
  side,
  isDesignatedAwper,
) {
  switch (strategy) {
    case "PISTOL": {
      const rand = Math.random();
      if (side === "T") {
        if (rand < 0.04)
          tryBuy(player, "TEC9", side);
        else if (rand < 0.1)
          tryBuy(
            player,
            "DUALIES",
            side,
          );
        else if (rand < 0.3)
          tryBuy(player, "P250", side);
      } else {
        if (rand < 0.3)
          tryBuy(
            player,
            "DUALIES",
            side,
          );
        else if (rand < 0.5)
          tryBuy(player, "P250", side);
      }
      return;
    }

    case "ECO": {
      const rand = Math.random();
      if (rand < 0.25)
        tryBuy(player, "DEAGLE", side);
      else if (rand < 0.5)
        tryBuy(player, "P250", side);
      return;
    }

    case "FORCE": {
      if (
        isDesignatedAwper &&
        tryBuy(player, "SSG08", side)
      )
        return;

      if (side === "T") {
        if (
          tryBuy(player, "AK47", side)
        )
          return;
        if (
          tryBuy(player, "GALIL", side)
        )
          return;
        if (
          tryBuy(player, "MAC10", side)
        )
          return;
        if (
          tryBuy(player, "TEC9", side)
        )
          return;
        tryBuy(
          player,
          "DEAGLE",
          side,
        ) ||
          tryBuy(player, "P250", side);
      } else {
        if (
          tryBuy(player, "M4A1S", side)
        )
          return;
        if (
          tryBuy(player, "M4A4", side)
        )
          return;
        if (
          tryBuy(player, "FAMAS", side)
        )
          return;
        if (tryBuy(player, "MP9", side))
          return;
        tryBuy(
          player,
          "FIVESEVEN",
          side,
        ) ||
          tryBuy(
            player,
            "DEAGLE",
            side,
          ) ||
          tryBuy(player, "P250", side);
      }
      return;
    }

    case "FULL":
    case "FULL_DUMP": {
      if (
        isDesignatedAwper &&
        tryBuy(player, "AWP", side)
      )
        return;

      if (side === "T") {
        if (
          tryBuy(player, "AK47", side)
        )
          return;
        if (
          tryBuy(player, "GALIL", side)
        )
          return;
        tryBuy(player, "MAC10", side) ||
          tryBuy(player, "TEC9", side);
      } else {
        const prefersM4A4 =
          player.aggression > 70;
        if (prefersM4A4) {
          if (
            tryBuy(player, "M4A4", side)
          )
            return;
          if (
            tryBuy(
              player,
              "M4A1S",
              side,
            )
          )
            return;
        } else {
          if (
            tryBuy(
              player,
              "M4A1S",
              side,
            )
          )
            return;
          if (
            tryBuy(player, "M4A4", side)
          )
            return;
        }
        tryBuy(player, "FAMAS", side) ||
          tryBuy(player, "MP9", side);
      }
      return;
    }

    default:
      return;
  }
}

function buyArmor(player, strategy) {
  const buyChance =
    ARMOR_BUY_CHANCE[strategy] ?? 0;
  if (Math.random() > buyChance) return;

  const wantsHelmet =
    strategy === "FULL" ||
    strategy === "FULL_DUMP";

  if (
    wantsHelmet &&
    player.money >=
      ARMOR.KEVLAR_HELMET.cost
  ) {
    player.money -=
      ARMOR.KEVLAR_HELMET.cost;
    player.armorValue =
      ARMOR.KEVLAR_HELMET.cost;
    return;
  }

  if (
    player.money >= ARMOR.KEVLAR.cost
  ) {
    player.money -= ARMOR.KEVLAR.cost;
    player.armorValue =
      ARMOR.KEVLAR.cost;
  }
}

function buyIdealWeapon(
  player,
  strategy,
  side,
  isDesignatedAwper,
) {
  player.armorValue = 0; // se recompra (o no) cada ronda

  if (player.weapon === "KNIFE") {
    player.weapon =
      getDefaultPistol(side);
  }

  if (isRifleOrSniper(player.weapon)) {
    buyArmor(player, strategy);
    buyUtility(player, strategy, side);
    return;
  }

  buyMainWeapon(
    player,
    strategy,
    side,
    isDesignatedAwper,
  );
  buyArmor(player, strategy);
  buyUtility(player, strategy, side);
}

export function decidePlayerBuys(
  team,
  strategy,
  side,
) {
  redistributeAWP(team, side);
  absorbWeaponPool(team, side);

  // el de mejor awpSkill es quien intenta comprar AWP/SSG, no solo el rol
  const bestAwper = team.players.reduce(
    (best, p) =>
      p.awpPriority > best.awpPriority ?
        p
      : best,
    team.players[0],
  );

  let totalSpent = 0;
  team.players.forEach((player) => {
    const moneyBefore = player.money;
    buyIdealWeapon(
      player,
      strategy,
      side,
      player === bestAwper,
    );
    totalSpent +=
      moneyBefore - player.money;
  });

  return totalSpent;
}

export function rewardKill(killer) {
  const weapon =
    WEAPONS[killer.weapon] ||
    WEAPONS.KNIFE;
  killer.money = Math.min(
    killer.money + weapon.killReward,
    MAX_MONEY,
  );
}

export function rewardPlant(planter) {
  planter.money = Math.min(
    planter.money + PLANT_BONUS,
    MAX_MONEY,
  );
}

export function applyRoundEconomy(
  teamA,
  teamB,
  winnerSide,
) {
  const winnerTeam =
    winnerSide === "T" ? teamA : teamB;
  const loserTeam =
    winnerSide === "T" ? teamB : teamA;

  winnerTeam.players.forEach((p) => {
    p.money = Math.min(
      p.money + WIN_REWARD,
      MAX_MONEY,
    );
  });
  winnerTeam.lossBonus = 1;

  const loseReward =
    LOSS_BONUS_TABLE[
      loserTeam.lossBonus - 1
    ];
  loserTeam.players.forEach((p) => {
    p.money = Math.min(
      p.money + loseReward,
      MAX_MONEY,
    );
  });
  loserTeam.lossBonus = Math.min(
    loserTeam.lossBonus + 1,
    5,
  );
}
export function applyCTKillBonus(
  ctTeam,
  tKillsCount,
) {
  if (tKillsCount <= 0) return;

  ctTeam.players.forEach((p) => {
    p.money = Math.min(
      p.money +
        tKillsCount * CT_KILL_BONUS,
      MAX_MONEY,
    );
  });
}
function redistributeAWP(team, side) {
  const bestAwper = team.players.reduce(
    (best, p) =>
      p.awpPriority > best.awpPriority ?
        p
      : best,
    team.players[0],
  );

  if (bestAwper.weapon === "AWP")
    return; // ya está con quien debe estar

  const accidentalHolder =
    team.players.find(
      (p) =>
        p.weapon === "AWP" &&
        p !== bestAwper,
    );

  if (!accidentalHolder) return; // nadie más tiene el AWP

  // El que lo tenía temporalmente vuelve a comprar su arma normalmente
  accidentalHolder.weapon = "KNIFE";
  bestAwper.weapon = "AWP";
}
