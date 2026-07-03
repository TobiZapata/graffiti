import { Team } from "../simulator/models/Team";
import { Player } from "../simulator/models/Player";
import { simulateRound } from "./RoundEngine";
import {
  decideTeamStrategy,
  decidePlayerBuys,
  applyRoundEconomy,
  applyCTKillBonus,
} from "./EconomyEngine";
import { textEvent } from "./EventFactory";
import { weaponPower } from "./WeaponEngine";

const POOL_MIN_POWER = 1;

const ROUNDS_PER_HALF = 12;
const REGULATION_TOTAL =
  ROUNDS_PER_HALF * 2;
const WIN_THRESHOLD =
  ROUNDS_PER_HALF + 1;

const OT_ROUNDS_PER_SIDE = 3;
const OT_PERIOD_ROUNDS =
  OT_ROUNDS_PER_SIDE * 2;
const OT_MONEY = 10000;

function resetLossBonusForHalf(team) {
  team.lossBonus = 2;
}

function buildTeam(teamConfig) {
  const players =
    teamConfig.players.map(
      (data) => new Player(data),
    );
  return new Team(
    teamConfig.name,
    players,
  );
}

function resetForOT(team) {
  team.players.forEach((player) => {
    player.money = OT_MONEY;
    player.weapon = "KNIFE";
    player.utilityValue = 0;
  });
  team.lossBonus = 2;
  team.weaponPool = [];
}

function distributeWeaponPool(
  winnerTeam,
  droppedWeapons,
) {
  droppedWeapons.forEach(
    ({ weaponId }) => {
      if (
        weaponPower(weaponId) >=
        POOL_MIN_POWER
      ) {
        winnerTeam.weaponPool.push(
          weaponId,
        );
      }
    },
  );
  winnerTeam.weaponPool =
    winnerTeam.weaponPool.slice(
      0,
      winnerTeam.players.length,
    );
}

function playRound(
  tTeam,
  ctTeam,
  label,
  isOT,
  allEvents,
  rounds,
) {
  const strategyT =
    isOT ? "FULL" : (
      decideTeamStrategy(tTeam, label)
    );
  const strategyCT =
    isOT ? "FULL" : (
      decideTeamStrategy(ctTeam, label)
    );

  decidePlayerBuys(
    tTeam,
    strategyT,
    "T",
  );
  decidePlayerBuys(
    ctTeam,
    strategyCT,
    "CT",
  );

  // ─── CAMBIO 2: capturar snapshot DESPUÉS de comprar, ANTES de simular ────
  const equipT = tTeam.equipmentValue;
  const equipCT = ctTeam.equipmentValue;
  const tSnap = tTeam.players.map(
    (p) => ({
      name: p.name,
      weapon: p.weapon,
    }),
  );
  const ctSnap = ctTeam.players.map(
    (p) => ({
      name: p.name,
      weapon: p.weapon,
    }),
  );
  // ─────────────────────────────────────────────────────────────────────────

  allEvents.push(
    textEvent(
      `--- Ronda ${label} | ${tTeam.name} (T): ${strategyT} ($${equipT}) vs ${ctTeam.name} (CT): ${strategyCT} ($${equipCT}) ---`,
    ),
  );

  const {
    events,
    winnerSide,
    droppedWeapons,
    tKillsCount,
  } = simulateRound(tTeam, ctTeam);
  allEvents.push(...events);

  const winnerTeam =
    winnerSide === "T" ? tTeam : ctTeam;
  winnerTeam.roundsWon += 1;

  distributeWeaponPool(
    winnerTeam,
    droppedWeapons,
  );
  applyCTKillBonus(ctTeam, tKillsCount);
  applyRoundEconomy(
    tTeam,
    ctTeam,
    winnerSide,
  );

  allEvents.push(
    textEvent(
      `Marcador: ${tTeam.name} ${tTeam.roundsWon} - ${ctTeam.roundsWon} ${ctTeam.name}`,
    ),
  );

  // ─── CAMBIO 3: pushear roundData al array ────────────────────────────────
  rounds.push({
    round: label,
    tTeam: tTeam.name,
    ctTeam: ctTeam.name,
    strategyT,
    strategyCT,
    equipT,
    equipCT,
    tPlayers: tSnap,
    ctPlayers: ctSnap,
    events, // objetos del EventFactory, listos para el viewer
    scoreT: tTeam.roundsWon,
    scoreCT: ctTeam.roundsWon,
    finalPlayers: [
      ...tTeam.players.map((p) => ({
        name: p.name,
        weapon: p.weapon,
      })),
      ...ctTeam.players.map((p) => ({
        name: p.name,
        weapon: p.weapon,
      })),
    ],
  });
  // ─────────────────────────────────────────────────────────────────────────
}

function playOTPeriod(
  team1,
  team2,
  periodNumber,
  allEvents,
  rounds,
) {
  resetForOT(team1);
  resetForOT(team2);

  for (
    let i = 1;
    i <= OT_PERIOD_ROUNDS;
    i++
  ) {
    const team1IsT =
      i <= OT_ROUNDS_PER_SIDE;
    const t = team1IsT ? team1 : team2;
    const ct = team1IsT ? team2 : team1;

    playRound(
      t,
      ct,
      `OT${periodNumber}.${i}`,
      true,
      allEvents,
      rounds,
    );

    const remaining =
      OT_PERIOD_ROUNDS - i;

    if (
      Math.abs(
        team1.roundsWon -
          team2.roundsWon,
      ) > remaining
    ) {
      return;
    }
  }
}

export function simulateMatch(
  team1Config,
  team2Config,
) {
  const allEvents = [];
  const rounds = []; // ─── CAMBIO 4: declarar el array ────────────────────

  const team1 = buildTeam(team1Config);
  const team2 = buildTeam(team2Config);

  for (
    let round = 1;
    round <= REGULATION_TOTAL;
    round++
  ) {
    if (
      round === 1 ||
      round === ROUNDS_PER_HALF + 1
    ) {
      resetLossBonusForHalf(team1);
      resetLossBonusForHalf(team2);
    }

    if (round === ROUNDS_PER_HALF + 1) {
      resetWeaponsForSideSwitch(team1);
      resetWeaponsForSideSwitch(team2);
    }

    const team1IsT =
      round <= ROUNDS_PER_HALF;
    const t = team1IsT ? team1 : team2;
    const ct = team1IsT ? team2 : team1;

    playRound(
      t,
      ct,
      round,
      false,
      allEvents,
      rounds,
    ); // ← rounds pasado acá

    if (
      team1.roundsWon >=
        WIN_THRESHOLD ||
      team2.roundsWon >= WIN_THRESHOLD
    ) {
      break;
    }
  }

  let otPeriod = 0;
  while (
    team1.roundsWon === team2.roundsWon
  ) {
    otPeriod += 1;
    allEvents.push(
      textEvent(
        `=== Overtime ${otPeriod} (reset a $${OT_MONEY} por jugador) ===`,
      ),
    );
    playOTPeriod(
      team1,
      team2,
      otPeriod,
      allEvents,
      rounds,
    ); // ← también acá
  }

  const winner =
    team1.roundsWon > team2.roundsWon ?
      team1
    : team2;

  const finalScore = `${team1.name} ${team1.roundsWon} - ${team2.roundsWon} ${team2.name} | Gana ${winner.name}`;
  allEvents.push(textEvent(finalScore));

  return {
    events: allEvents,
    finalScore,
    rounds,
    scoreTeam1: team1.roundsWon,
    scoreTeam2: team2.roundsWon,
  };
}

function resetWeaponsForSideSwitch(
  team,
) {
  team.players.forEach((player) => {
    player.weapon = "KNIFE";
    player.armorValue = 0;
    player.utilityValue = 0;
    player.money = 800;
  });
  team.weaponPool = [];
  team.lossBonus = 2;
}
