import {
  WEAPONS,
  SCOPED_WEAPONS,
} from "./WeaponEngine";

export const KILL_MODIFIERS = {
  NO_SCOPE: "NO_SCOPE",
  THROUGH_SMOKE: "THROUGH_SMOKE",
  WALLBANG: "WALLBANG",
  HEADSHOT: "HEADSHOT",
};

// orden de prioridad pedido: noscope > humo > wallbang > headshot
const MODIFIER_PRIORITY = [
  KILL_MODIFIERS.NO_SCOPE,
  KILL_MODIFIERS.THROUGH_SMOKE,
  KILL_MODIFIERS.WALLBANG,
  KILL_MODIFIERS.HEADSHOT,
];

const MODIFIER_LABELS = {
  NO_SCOPE: "no scope",
  THROUGH_SMOKE: "a través del humo",
  WALLBANG: "wallbang",
  HEADSHOT: "headshot",
};

const UTILITY_WEAPONS = new Set([
  "HE",
  "MOLOTOV",
  "INCENDIARY",
]);

function getWeaponName(weaponId) {
  return (
    WEAPONS[weaponId]?.name ?? weaponId
  );
}

function rollModifiers(
  killer,
  weaponId,
) {
  if (UTILITY_WEAPONS.has(weaponId)) {
    return []; // las granadas no tienen headshot/wallbang/no-scope
  }

  const modifiers = [];

  if (
    Math.random() <
    killer.aim * 0.007
  )
    modifiers.push(
      KILL_MODIFIERS.HEADSHOT,
    );

  if (
    SCOPED_WEAPONS.has(weaponId) &&
    Math.random() <
      killer.aggression * 0.0021
  ) {
    modifiers.push(
      KILL_MODIFIERS.NO_SCOPE,
    );
  }

  if (
    Math.random() <
    killer.utility * 0.003
  )
    modifiers.push(
      KILL_MODIFIERS.THROUGH_SMOKE,
    );
  if (
    Math.random() <
    killer.aim * 0.0015
  )
    modifiers.push(
      KILL_MODIFIERS.WALLBANG,
    );

  return modifiers.sort(
    (a, b) =>
      MODIFIER_PRIORITY.indexOf(a) -
      MODIFIER_PRIORITY.indexOf(b),
  );
}

// kill propia estando cegado: muy raro, mas raro cuanta mas composure tenga
function rollKillerBlind(killer) {
  const chance = Math.max(
    0.005,
    0.03 - killer.composure * 0.0002,
  );
  return Math.random() < chance;
}

function rollAirborne(
  killer,
  weaponId,
) {
  if (UTILITY_WEAPONS.has(weaponId))
    return false;
  const chance =
    0.006 + killer.aggression * 0.00004;
  return Math.random() < chance;
}

// asistencia: SUPPORT tiene mas chance de ser el asistente, y mas chance de que sea por flash
export function rollAssist(
  killer,
  teammates,
) {
  const pool = teammates.filter(
    (p) => p !== killer,
  );
  if (pool.length === 0) return null;
  if (Math.random() > 0.18) return null;

  const weights = pool.map((p) =>
    p.role === "SUPPORT" ? 2 : 1,
  );
  const totalWeight = weights.reduce(
    (a, b) => a + b,
    0,
  );
  let rand =
    Math.random() * totalWeight;
  let assister = pool[0];

  for (
    let i = 0;
    i < pool.length;
    i++
  ) {
    rand -= weights[i];
    if (rand <= 0) {
      assister = pool[i];
      break;
    }
  }

  const flashChance =
    assister.role === "SUPPORT" ?
      0.6
    : 0.35;
  const type =
    Math.random() < flashChance ?
      "FLASH"
    : "DAMAGE";

  return { name: assister.name, type };
}

function buildKillText({
  killerBlind,
  killer,
  assist,
  airborne,
  weaponName,
  modifiers,
  victim,
}) {
  const parts = [];

  if (killerBlind)
    parts.push("[cegado]");
  parts.push(killer.name);

  if (assist) {
    const label =
      assist.type === "FLASH" ?
        "asistencia de flash"
      : "asistencia de daño";
    parts.push(
      `[${label} de ${assist.name}]`,
    );
  }

  if (airborne) parts.push("[volando]");
  parts.push(`[${weaponName}]`);

  // filtra labels vacíos antes de decidir si mostrar el bracket — esto es lo que arregla "[]" y comas colgantes
  const modifierLabels = modifiers
    .map((m) => MODIFIER_LABELS[m])
    .filter(Boolean);
  if (modifierLabels.length > 0) {
    parts.push(
      `[${modifierLabels.join(", ")}]`,
    );
  }

  parts.push(victim.name);
  return parts.join(" ");
}

export function killEvent(
  killer,
  victim,
  options = {},
) {
  const {
    subtype = null,
    weaponOverride = null,
    teammates = [],
  } = options;

  const weaponId =
    weaponOverride || killer.weapon;
  const modifiers = rollModifiers(
    killer,
    weaponId,
  );
  const killerBlind =
    rollKillerBlind(killer);
  const airborne = rollAirborne(
    killer,
    weaponId,
  );
  const assist = rollAssist(
    killer,
    teammates,
  );
  const weaponName =
    getWeaponName(weaponId);

  const text = buildKillText({
    killerBlind,
    killer,
    assist,
    airborne,
    weaponName,
    modifiers,
    victim,
  });

  return {
    type: "KILL",
    subtype,
    killerBlind,
    killer: {
      name: killer.name,
      weapon: weaponId,
    },
    assist,
    airborne,
    modifiers,
    victim: { name: victim.name },
    text,
  };
}

export function plantEvent(player) {
  return {
    type: "PLANT",
    player: { name: player.name },
    text: `${player.name} planta la bomba`,
  };
}

export function defuseEvent(
  player,
  withOpposition = false,
) {
  return {
    type: "DEFUSE",
    player: { name: player.name },
    withOpposition,
    text:
      withOpposition ?
        `${player.name} desactiva la bomba`
      : `${player.name} desactiva la bomba sin oposición`,
  };
}

export function saveEvent(player) {
  return {
    type: "SAVE",
    player: { name: player.name },
    text: `${player.name} decide guardar`,
  };
}

export function textEvent(text) {
  return { type: "TEXT", text };
}

export function weaponPickupEvent(
  player,
  weaponId,
) {
  return {
    type: "WEAPON_PICKUP",
    player: { name: player.name },
    weapon: weaponId,
    text: null, // no aparece en el feed, solo actualiza el estado visual
  };
}
export function suicideEvent(victim) {
  return {
    type: "SUICIDE",
    victim: { name: victim.name },
  };
}

export function bombKillEvent(victim) {
  return {
    type: "BOMB_KILL",
    victim: { name: victim.name },
  };
}
