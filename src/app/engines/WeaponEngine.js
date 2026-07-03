export const WEAPONS = {
  KNIFE: {
    id: "KNIFE",
    name: "Cuchillo",
    cost: 0,
    killReward: 1500,
    power: 0,
    side: "BOTH",
    image:
      "/weapons/knife_karambit.svg",
  },

  GLOCK: {
    id: "GLOCK",
    name: "Glock-18",
    cost: 150,
    killReward: 300,
    power: 10,
    side: "T",
    image: "/weapons/glock.svg",
  },
  USP: {
    id: "USP",
    name: "USP-S",
    cost: 150,
    killReward: 300,
    power: 12,
    side: "CT",
    image: "/weapons/usp_silencer.svg",
  },

  P250: {
    id: "P250",
    name: "P250",
    cost: 300,
    killReward: 300,
    power: 18,
    side: "BOTH",
    image: "/weapons/p250.svg",
  },
  DEAGLE: {
    id: "DEAGLE",
    name: "Desert Eagle",
    cost: 700,
    killReward: 300,
    power: 35,
    side: "BOTH",
    image: "/weapons/deagle.svg",
  },
  DUALIES: {
    id: "DUALIES",
    name: "Dual Berettas",
    cost: 300,
    killReward: 300,
    power: 14,
    side: "BOTH",
    image: "/weapons/elite.svg",
  },
  TEC9: {
    id: "TEC9",
    name: "Tec-9",
    cost: 500,
    killReward: 300,
    power: 22,
    side: "T",
    image: "/weapons/tec9.svg",
  },
  FIVESEVEN: {
    id: "FIVESEVEN",
    name: "Five-SeveN",
    cost: 500,
    killReward: 300,
    power: 22,
    side: "CT",
    image: "/weapons/fiveseven.svg",
  },

  MAC10: {
    id: "MAC10",
    name: "MAC-10",
    cost: 1050,
    killReward: 600,
    power: 28,
    side: "T",
    image: "/weapons/mac10.svg",
  },
  MP9: {
    id: "MP9",
    name: "MP9",
    cost: 1250,
    killReward: 600,
    power: 30,
    side: "CT",
    image: "/weapons/mp9.svg",
  },

  GALIL: {
    id: "GALIL",
    name: "Galil AR",
    cost: 2000,
    killReward: 300,
    power: 52,
    side: "T",
    image: "/weapons/galilar.svg",
  },
  FAMAS: {
    id: "FAMAS",
    name: "FAMAS",
    cost: 2250,
    killReward: 300,
    power: 52,
    side: "CT",
    image: "/weapons/famas.svg",
  },

  AK47: {
    id: "AK47",
    name: "AK-47",
    cost: 2700,
    killReward: 300,
    power: 68,
    side: "T",
    image: "/weapons/ak47.svg",
  },
  M4A1S: {
    id: "M4A1S",
    name: "M4A1-S",
    cost: 2900,
    killReward: 300,
    power: 63,
    side: "CT",
    image: "/weapons/m4a1_silencer.svg",
  },
  M4A4: {
    id: "M4A4",
    name: "M4A4",
    cost: 3100,
    killReward: 300,
    power: 63,
    side: "CT",
    image: "/weapons/m4a1.svg",
  },

  SSG08: {
    id: "SSG08",
    name: "SSG 08",
    cost: 1700,
    killReward: 300,
    power: 60,
    side: "BOTH",
    image: "/weapons/ssg08.svg",
  },
  AWP: {
    id: "AWP",
    name: "AWP",
    cost: 4750,
    killReward: 100,
    power: 82,
    side: "BOTH",
    image: "/weapons/awp.svg",
  },

  HE: {
    id: "HE",
    name: "Granada",
    cost: 0,
    killReward: 300,
    power: 0,
    side: "BOTH",
    image: "/weapons/hegrenade.svg",
  },
  MOLOTOV: {
    id: "MOLOTOV",
    name: "Mólotov",
    cost: 400,
    killReward: 300,
    power: 0,
    side: "T",
    image: "/weapons/inferno.svg",
  },
  INCENDIARY: {
    id: "INCENDIARY",
    name: "Granada incendiaria",
    cost: 500,
    killReward: 300,
    power: 0,
    side: "CT",
    image: "/weapons/inferno.svg",
  },
};

export function getDefaultPistol(side) {
  return side === "T" ? "GLOCK" : "USP";
}

export function weaponPower(weaponId) {
  return WEAPONS[weaponId]?.power ?? 0;
}

// true si "candidato" es estrictamente mejor que el arma actual
// (y nunca permite duplicar un AWP)
export function isUpgrade(
  currentWeaponId,
  candidateWeaponId,
) {
  if (
    candidateWeaponId === "AWP" &&
    currentWeaponId === "AWP"
  )
    return false;
  return (
    weaponPower(candidateWeaponId) >
    weaponPower(currentWeaponId)
  );
}
export const SCOPED_WEAPONS = new Set([
  "AWP",
  "SSG08",
]);
export const MAIN_RIFLES = new Set([
  "AK47",
  "M4A1S",
  "M4A4",
]);
