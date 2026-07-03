import { weightedDuel } from "../utils/weightedDuel";
import { weightedRandomPlayer } from "../utils/weightedRandomPlayer";
import {
  rewardKill,
  rewardPlant,
  isLastRoundOfHalf,
} from "./EconomyEngine";
import {
  killEvent,
  plantEvent,
  defuseEvent,
  saveEvent,
  textEvent,
  weaponPickupEvent,
} from "./EventFactory";
import {
  isUpgrade,
  weaponPower,
} from "./WeaponEngine";
import { WEAPONS } from "./WeaponEngine";

const ROUND_TIME_SECONDS = 115;
const UTILITY_KILL_CHANCE = 0.025;

function randomBetween(min, max) {
  return (
    min + Math.random() * (max - min)
  );
}

function createRoundState(
  teamA,
  teamB,
) {
  return {
    teamA,
    teamB,
    aliveA: [...teamA.players],
    aliveB: [...teamB.players],
    bombPlanted: false,
    siteControl: 0,
    timeRemaining: ROUND_TIME_SECONDS,
    groundWeapons: [],
    tKillsCount: 0,
    events: [],
  };
}

function advanceTime(state, seconds) {
  state.timeRemaining = Math.max(
    0,
    state.timeRemaining - seconds,
  );
}

// ─── helper: mejor candidato dentro de un pool ──────────────────────────────
function selectBestCandidate(
  candidates,
  weaponId,
) {
  if (weaponId === "AWP") {
    return [...candidates].sort(
      (a, b) =>
        b.awpPriority - a.awpPriority,
    )[0];
  }
  // el que menos firepower tiene se beneficia más del upgrade
  return [...candidates].sort(
    (a, b) =>
      weaponPower(a.weapon) -
      weaponPower(b.weapon),
  )[0];
}

// ─── pickup mid-ronda: compañero (55%) o enemigo (45%) ──────────────────────
const AWP_MID_ROUND_MIN_POWER = 63; // necesitás rifle para usar AWP mid-ronda
const MID_ROUND_PICKUP_CHANCE = 0.35;

function attemptMidRoundPickup(
  state,
  droppedWeaponId,
  winnerAlive,
  loserAlive,
  loser,
) {
  if (
    Math.random() >
    MID_ROUND_PICKUP_CHANCE
  )
    return;
  if (
    !droppedWeaponId ||
    droppedWeaponId === "KNIFE"
  )
    return;

  const isAWP =
    droppedWeaponId === "AWP";

  const eligible = (p) => {
    if (p === loser) return false; // el muerto no recoge su propia arma
    if (isAWP) {
      return (
        p.weapon !== "AWP" &&
        weaponPower(p.weapon) <
          AWP_MID_ROUND_MIN_POWER
      );
    }
    return isUpgrade(
      p.weapon,
      droppedWeaponId,
    );
  };

  const winnerPool =
    winnerAlive.filter(eligible);
  const loserPool =
    loserAlive.filter(eligible);

  if (
    winnerPool.length === 0 &&
    loserPool.length === 0
  )
    return;

  // compañero del ganador ligeramente más probable
  let pool;
  if (
    winnerPool.length > 0 &&
    loserPool.length > 0
  ) {
    pool =
      Math.random() < 0.55 ?
        winnerPool
      : loserPool;
  } else {
    pool =
      winnerPool.length > 0 ?
        winnerPool
      : loserPool;
  }

  const chosen = selectBestCandidate(
    pool,
    droppedWeaponId,
  );
  if (!chosen) return;

  chosen.weapon = droppedWeaponId;

  // sacar del suelo
  const idx =
    state.groundWeapons.indexOf(
      droppedWeaponId,
    );
  if (idx !== -1)
    state.groundWeapons.splice(idx, 1);

  state.events.push(
    weaponPickupEvent(
      chosen,
      droppedWeaponId,
    ),
  );
}

// ─── pickup fin de ronda: sobrevivientes recogen todo lo que pueden ──────────
function distributeEndOfRoundWeapons(
  state,
  winnerSide,
) {
  const survivors =
    winnerSide === "T" ?
      state.aliveA
    : state.aliveB;

  if (
    survivors.length === 0 ||
    state.groundWeapons.length === 0
  )
    return;

  // distribuir de mayor a menor firepower
  const sorted = [
    ...state.groundWeapons,
  ].sort(
    (a, b) =>
      weaponPower(b) - weaponPower(a),
  );

  for (const weaponId of sorted) {
    if (
      !weaponId ||
      weaponId === "KNIFE"
    )
      continue;

    const isAWP = weaponId === "AWP";

    const candidates = survivors.filter(
      (p) =>
        isAWP ?
          p.weapon !== "AWP" &&
          isUpgrade(p.weapon, weaponId)
        : isUpgrade(p.weapon, weaponId),
    );

    if (candidates.length === 0)
      continue;

    const chosen = selectBestCandidate(
      candidates,
      weaponId,
    );
    if (!chosen) continue;

    chosen.weapon = weaponId;

    const idx =
      state.groundWeapons.indexOf(
        weaponId,
      );
    if (idx !== -1)
      state.groundWeapons.splice(
        idx,
        1,
      );

    state.events.push(
      weaponPickupEvent(
        chosen,
        weaponId,
      ),
    );
  }
}

function pickUtilityWeapon(winnerSide) {
  const fireWeapon =
    winnerSide === "T" ? "MOLOTOV" : (
      "INCENDIARY"
    );
  return Math.random() < 0.5 ?
      "HE"
    : fireWeapon;
}

function resolveDuel(playerA, playerB) {
  if (
    Math.random() < UTILITY_KILL_CHANCE
  ) {
    const totalUtility =
      playerA.utility + playerB.utility;
    const winner =
      (
        Math.random() * totalUtility <
        playerA.utility
      ) ?
        playerA
      : playerB;
    const winnerSide =
      winner === playerA ? "T" : "CT";
    return {
      winner,
      weaponOverride:
        pickUtilityWeapon(winnerSide),
    };
  }

  const winner = weightedDuel(
    playerA,
    playerB,
  );
  return {
    winner,
    weaponOverride: null,
  };
}

function processKill(
  state,
  winner,
  loser,
  winnerTeamAlive,
  loserTeamAlive,
  weaponOverride,
  subtype,
) {
  rewardKill(winner);

  if (loserTeamAlive === state.aliveA)
    state.tKillsCount += 1;

  const droppedWeapon = loser.weapon;
  loser.weapon = "KNIFE";

  const winnerFullRoster =
    winnerTeamAlive === state.aliveA ?
      state.teamA.players
    : state.teamB.players;
  const teammates =
    winnerFullRoster.filter(
      (p) => p !== winner,
    );

  state.events.push(
    killEvent(winner, loser, {
      subtype,
      weaponOverride,
      teammates,
    }),
  );

  // el arma cae al suelo
  state.groundWeapons.push(
    droppedWeapon,
  );

  // intento de pickup inmediato
  attemptMidRoundPickup(
    state,
    droppedWeapon,
    winnerTeamAlive,
    loserTeamAlive,
    loser,
  );
}

function attemptPlant(state) {
  if (
    state.bombPlanted ||
    state.aliveA.length === 0
  )
    return;

  const aliveT = state.aliveA.length;
  const aliveCT = state.aliveB.length;
  const playerAdvantage =
    aliveT - aliveCT;

  let plantChance =
    10 +
    playerAdvantage * 12 +
    state.siteControl * 0.5;
  if (state.timeRemaining < 20)
    plantChance += 25;
  plantChance = Math.max(
    0,
    Math.min(90, plantChance),
  );

  if (
    Math.random() * 100 <
    plantChance
  ) {
    state.bombPlanted = true;
    state.siteControl += 30;

    const planter =
      weightedRandomPlayer(
        state.aliveA,
      );
    rewardPlant(planter);
    state.events.push(
      plantEvent(planter),
    );
  }
}

function openingDuel(state) {
  const entryPlayer = [
    ...state.aliveA,
  ].sort(
    (a, b) =>
      b.entryRating - a.entryRating,
  )[0];
  const defender =
    state.aliveB[
      Math.floor(
        Math.random() *
          state.aliveB.length,
      )
    ];

  const { winner, weaponOverride } =
    resolveDuel(entryPlayer, defender);
  const loser =
    winner === entryPlayer ? defender
    : entryPlayer;
  const subtype =
    winner === entryPlayer ?
      "ENTRY_KILL"
    : "ENTRY_STOPPED";

  advanceTime(
    state,
    randomBetween(15, 25),
  );

  if (winner === entryPlayer) {
    processKill(
      state,
      winner,
      loser,
      state.aliveA,
      state.aliveB,
      weaponOverride,
      subtype,
    );
    state.siteControl += 20;
    state.aliveB = state.aliveB.filter(
      (p) => p !== defender,
    );
  } else {
    processKill(
      state,
      winner,
      loser,
      state.aliveB,
      state.aliveA,
      weaponOverride,
      subtype,
    );
    state.siteControl -= 20;
    state.aliveA = state.aliveA.filter(
      (p) => p !== entryPlayer,
    );
  }
}

function tradeKill(state) {
  if (
    state.aliveA.length === 0 ||
    state.aliveB.length === 0
  )
    return;

  const playerA = weightedRandomPlayer(
    state.aliveA,
  );
  const playerB = weightedRandomPlayer(
    state.aliveB,
  );

  const { winner, weaponOverride } =
    resolveDuel(playerA, playerB);
  const loser =
    winner === playerA ? playerB : (
      playerA
    );

  advanceTime(
    state,
    randomBetween(8, 18),
  );

  if (winner === playerA) {
    processKill(
      state,
      winner,
      loser,
      state.aliveA,
      state.aliveB,
      weaponOverride,
      null,
    );
    state.siteControl += 10;
    state.aliveB = state.aliveB.filter(
      (p) => p !== playerB,
    );
  } else {
    processKill(
      state,
      winner,
      loser,
      state.aliveB,
      state.aliveA,
      weaponOverride,
      null,
    );
    state.siteControl -= 10;
    state.aliveA = state.aliveA.filter(
      (p) => p !== playerA,
    );
  }
}

function resolvePostPlant(state) {
  const aliveT = state.aliveA.length;
  const aliveCT = state.aliveB.length;

  // T eliminó a todos los CT: gana por eliminación aunque la bomba esté plantada.
  // No se muestra "por explosión" porque la ronda terminó antes de que explote.
  if (aliveCT === 0) {
    return "T";
  }

  // No quedan T: el CT desactiva sin presión
  if (aliveT === 0) {
    const defuser =
      weightedRandomPlayer(
        state.aliveB,
      );
    state.events.push(
      defuseEvent(defuser, false),
    );
    return "CT";
  }

  // Ambos lados vivos post-plant
  state.events.push(
    textEvent(
      `${state.teamA.name} defiende la bomba`,
    ),
  );

  const saveChance =
    aliveCT === 1 ? 40
    : aliveCT === 2 ? 15
    : 5;

  if (
    Math.random() * 100 <
    saveChance
  ) {
    const saver = state.aliveB[0];
    state.events.push(saveEvent(saver));
    state.events.push(
      textEvent(
        `${state.teamA.name} gana por explosión`,
      ),
    );
    return "T";
  }

  const defuser = weightedRandomPlayer(
    state.aliveB,
  );
  state.events.push(
    defuseEvent(defuser, true),
  );
  return "CT";
}
function checkCTSaves(state) {
  const aliveT = state.aliveA.length;
  if (
    aliveT === 0 ||
    state.aliveB.length === 0
  )
    return;

  const staying = [];

  for (const ct of state.aliveB) {
    const weaponCost =
      WEAPONS[ct.weapon]?.cost ?? 0;

    let saveChance = 3;
    const disadvantage =
      aliveT - state.aliveB.length;
    if (disadvantage > 0)
      saveChance += disadvantage * 7;

    if (weaponCost >= 4750)
      saveChance += 30;
    else if (weaponCost >= 2700)
      saveChance += 15;
    else if (weaponCost >= 1700)
      saveChance += 8;

    saveChance = Math.min(
      70,
      saveChance,
    );

    if (
      Math.random() * 100 <
      saveChance
    ) {
      state.events.push(saveEvent(ct));
    } else {
      staying.push(ct);
    }
  }

  state.aliveB = staying;
}
export function simulateRound(
  teamA,
  teamB,
) {
  const state = createRoundState(
    teamA,
    teamB,
  );

  openingDuel(state);

  while (
    state.aliveA.length > 0 &&
    state.aliveB.length > 0 &&
    !state.bombPlanted &&
    state.timeRemaining > 0
  ) {
    tradeKill(state);
    if (
      state.aliveA.length === 0 ||
      state.aliveB.length === 0
    )
      break;
    attemptPlant(state);
  }

  if (state.bombPlanted) {
    while (
      state.aliveA.length > 0 &&
      state.aliveB.length > 0
    ) {
      checkCTSaves(state);
      if (state.aliveB.length === 0)
        break;
      tradeKill(state);
    }
  }

  if (
    !state.bombPlanted &&
    state.aliveA.length > 0 &&
    state.aliveB.length === 0 &&
    state.timeRemaining > 0
  ) {
    attemptPlant(state);
  }

  let winnerSide;

  if (
    state.bombPlanted &&
    state.aliveB.length === 0 &&
    state.aliveA.length === 0
  ) {
    state.events.push(
      textEvent(
        `${teamA.name} gana por explosión`,
      ),
    );
    winnerSide = "T";
  } else if (state.bombPlanted) {
    winnerSide =
      resolvePostPlant(state);
  } else if (
    state.timeRemaining <= 0 &&
    state.aliveA.length > 0 &&
    state.aliveB.length > 0
  ) {
    state.events.push(
      textEvent("Se acaba el tiempo"),
    );
    winnerSide = "CT";
  } else {
    winnerSide =
      state.aliveA.length > 0 ?
        "T"
      : "CT";
  }

  // los sobrevivientes recogen lo que queda en el suelo (100%)
  // esto va ANTES del evento ganador para que el viewer actualice las armas
  distributeEndOfRoundWeapons(
    state,
    winnerSide,
  );

  state.events.push(
    textEvent(
      winnerSide === "T" ?
        `${teamA.name} gana la ronda`
      : `${teamB.name} gana la ronda`,
    ),
  );

  return {
    events: state.events,
    winnerSide,
    bombPlanted: state.bombPlanted,
    droppedWeapons: state.groundWeapons, // solo las que nadie recogió
    tKillsCount: state.tKillsCount,
  };
}
