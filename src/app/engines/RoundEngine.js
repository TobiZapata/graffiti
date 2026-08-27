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
  bombKillEvent,
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
const MID_ROUND_PICKUP_CHANCE = 0.35;

function getDynamicPower(weaponId, aliveTeamMembers) {
  const basePower = weaponPower(weaponId);
  if (weaponId === "AWP") {
    const awpCount = aliveTeamMembers.filter(m => m.weapon === "AWP").length;
    if (awpCount >= 2) return 0;
    if (awpCount === 1) return 62; // Menor que M4 (63) y AK (68)
  }
  return basePower;
}

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

  const eligible = (p, teamAlive) => {
    if (p === loser) return false; // el muerto no recoge su propia arma
    if (droppedWeaponId === "AWP" && p.weapon === "AWP") return false;
    
    const currentPower = getDynamicPower(p.weapon, teamAlive);
    const dropPower = getDynamicPower(droppedWeaponId, teamAlive);
    return dropPower > currentPower;
  };

  const winnerPool =
    winnerAlive.filter(p => eligible(p, winnerAlive));
  const loserPool =
    loserAlive.filter(p => eligible(p, loserAlive));

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

  let weaponPicked = true;
  while (weaponPicked && state.groundWeapons.length > 0) {
    weaponPicked = false;
    
    // distribuir de mayor a menor firepower dinámico (recalculado en cada pick)
    const sorted = [
      ...state.groundWeapons,
    ].sort(
      (a, b) =>
        getDynamicPower(b, survivors) - getDynamicPower(a, survivors),
    );

    for (let i = 0; i < sorted.length; i++) {
      const weaponId = sorted[i];
      if (
        !weaponId ||
        weaponId === "KNIFE"
      )
        continue;
      
      const dropPower = getDynamicPower(weaponId, survivors);
      if (dropPower === 0) continue;

      const candidates = survivors.filter(
        (p) => {
          if (weaponId === "AWP" && p.weapon === "AWP") return false;
          return dropPower > getDynamicPower(p.weapon, survivors);
        }
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
      
      weaponPicked = true;
      break; // Reiniciamos el while para recalcular prioridades
    }
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
  winner.kills += 1;
  loser.deaths += 1;

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

  const ev = killEvent(winner, loser, {
    subtype,
    weaponOverride,
    teammates,
  });
  state.events.push(ev);

  if (ev.assist) {
    const assisterUid = ev.assist.uid;
    const allPlayers = [...state.teamA.players, ...state.teamB.players];
    const assisterPlayer = allPlayers.find(p => p.uid === assisterUid);
    if (assisterPlayer) assisterPlayer.assists += 1;
  }

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

function resolvePostPlant(state, canSaveCT) {
  const aliveT = state.aliveA.length;
  const aliveCT = state.aliveB.length;

  // T eliminó a todos los CT: gana por eliminación aunque la bomba esté plantada.
  // No se muestra "por explosión" porque la ronda terminó antes de que explote.
  if (state.aliveB.length === 0)
    return "T"; // Si no quedan CTs (por ejemplo se murieron por la explosión)

  // CT defusea si no hay Ts y le da el tiempo
  if (state.aliveA.length === 0) {
    const defuser = weightedRandomPlayer(
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
    Math.random() * 100 < saveChance &&
    canSaveCT
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
function checkCTSaves(state, canSaveCT) {
  if (!canSaveCT) return;
  
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
  canSaveT = true,
  canSaveCT = true,
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
      checkCTSaves(state, canSaveCT);
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
  let winType;

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
    winType = "BOMB";
  } else if (state.bombPlanted) {
    winnerSide =
      resolvePostPlant(state, canSaveCT);
    winType = winnerSide === "T" ? "BOMB" : "DEFUSE";
  } else if (
    state.timeRemaining <= 0 &&
    state.aliveA.length > 0 &&
    state.aliveB.length > 0
  ) {
    state.events.push(
      textEvent("Se acaba el tiempo"),
    );
    winnerSide = "CT";
    winType = "TIME";
  } else {
    winnerSide =
      state.aliveA.length > 0 ?
        "T"
      : "CT";
    winType = "KILL";
  }

  // los sobrevivientes recogen lo que queda en el suelo (100%)
  // esto va ANTES del evento ganador para que el viewer actualice las armas
  distributeEndOfRoundWeapons(
    state,
    winnerSide,
  );

  state.events.push({
    ...textEvent(
      winnerSide === "T" ?
        `${teamA.name} gana la ronda`
      : `${teamB.name} gana la ronda`,
    ),
    winnerSide,
  });

  // EXPLOSION DEATHS (solo si la ronda terminó por explosión del c4)
  if (state.bombPlanted && winnerSide === "T") {
    const explosionKillChance = 0.05; // 5% chance de morir por la bomba

    state.aliveA.forEach((p) => {
      if (Math.random() < explosionKillChance) {
        state.events.push({ ...bombKillEvent(p), victimSide: "T" });
        p.weapon = "KNIFE";
        p.armorValue = 0;
        p.utilityValue = 0;
        p.deaths += 1;
      }
    });

    state.aliveB.forEach((p) => {
      if (Math.random() < explosionKillChance) {
        state.events.push({ ...bombKillEvent(p), victimSide: "CT" });
        p.weapon = "KNIFE";
        p.armorValue = 0;
        p.utilityValue = 0;
        p.deaths += 1;
      }
    });
  }

  return {
    events: state.events,
    winnerSide,
    winType,
    bombPlanted: state.bombPlanted,
    droppedWeapons: state.groundWeapons, // solo las que nadie recogió
    tKillsCount: state.tKillsCount,
  };
}
