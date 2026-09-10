const fs = require('fs');
const path = require('path');
const { generatePlayerStats } = require('./statEngine');

// Raw HLTV data: [name, team, rating, rounds]
const raw = [
  ["swag", "iBUYPOWER", 1.43, 63],
  ["apEX", "LDLC", 1.38, 182],
  ["Dosia", "HellRaisers", 1.35, 64],
  ["kioShiMa", "Epsilon", 1.33, 88],
  ["kennyS", "Titan", 1.28, 74],
  ["Snax", "Virtus.pro", 1.27, 134],
  ["flusha", "fnatic", 1.24, 275],
  ["Edward", "Natus Vincere", 1.22, 166],
  ["shox", "Epsilon", 1.21, 88],
  ["olofmeister", "fnatic", 1.19, 275],
  ["Happy", "LDLC", 1.17, 182],
  ["cajunb", "CPH Wolves", 1.15, 79],
  ["device", "Dignitas", 1.14, 178],
  ["friberg", "NiP", 1.14, 314],
  ["dupreeh", "Dignitas", 1.13, 178],
  ["Hiko", "Cloud9", 1.13, 154],
  ["pashaBiceps", "Virtus.pro", 1.11, 134],
  ["JW", "fnatic", 1.10, 275],
  ["KQLY", "LDLC", 1.09, 182],
  ["GeT_RiGhT", "NiP", 1.06, 314],
  ["Havoc", "Vox Eminor", 1.06, 42],
  ["Xizt", "NiP", 1.06, 314],
  ["KRIMZ", "fnatic", 1.04, 275],
  ["GuardiaN", "Natus Vincere", 1.04, 166],
  ["byali", "Virtus.pro", 1.04, 134],
  ["SEMPHIS", "Cloud9", 1.03, 154],
  ["Xyp9x", "Dignitas", 1.03, 178],
  ["AZR", "Vox Eminor", 1.03, 42],
  ["shroud", "Cloud9", 1.01, 154],
  ["FeTiSh", "Dignitas", 1.01, 178],
  ["TaZ", "Virtus.pro", 1.01, 134],
  ["aizy", "Dignitas", 1.01, 178],
  ["f0rest", "NiP", 1.01, 314],
  ["flamie", "dAT", 0.99, 45],
  ["gla1ve", "CPH Wolves", 0.99, 79],
  ["seang@res", "Cloud9", 0.97, 154],
  ["Nico", "CPH Wolves", 0.97, 79],
  ["seized", "Natus Vincere", 0.96, 166],
  ["SmithZz", "Titan", 0.96, 74],
  ["Sf", "Epsilon", 0.96, 88],
  ["fxy0", "Epsilon", 0.95, 88],
  ["markeloff", "HellRaisers", 0.94, 64],
  ["starix", "Natus Vincere", 0.94, 166],
  ["karrigan", "CPH Wolves", 0.94, 79],
  ["GMX", "Epsilon", 0.93, 88],
  ["NEO", "Virtus.pro", 0.91, 134],
  ["ScreaM", "Titan", 0.90, 74],
  ["Ex6TenZ", "Titan", 0.90, 74],
  ["ANGE1", "HellRaisers", 0.85, 64],
  ["n0thing", "Cloud9", 0.85, 154],
  ["Maniac", "LDLC", 0.84, 182],
  ["Uzzziii", "LDLC", 0.84, 182],
  ["Zeus", "Natus Vincere", 0.82, 166],
  ["rain", "London Conspiracy", 0.81, 39],
  ["pronax", "fnatic", 0.80, 275],
  ["Pimp", "CPH Wolves", 0.78, 79],
  ["NBK-", "Titan", 0.74, 74],
  ["Ace", "Wolf", 0.73, 43],
  ["AZK", "iBUYPOWER", 0.72, 63],
  ["Fifflaren", "NiP", 0.71, 314],
  ["AdreN", "HellRaisers", 0.71, 64],
  ["RiTz", "Wolf", 0.70, 43],
  ["kUcheR", "HellRaisers", 0.69, 64],
  ["DaZeD", "iBUYPOWER", 0.67, 63],
  ["steel", "iBUYPOWER", 0.67, 63],
  ["jks", "Vox Eminor", 0.66, 42],
  ["WorldEdit", "dAT", 0.65, 45],
  ["Skadoodle", "iBUYPOWER", 0.62, 63],
  ["RUBINO", "London Conspiracy", 0.62, 39],
  ["astaRR", "Wolf", 0.60, 43],
  ["RiX", "Wolf", 0.60, 43],
  ["B1ad3", "dAT", 0.59, 45],
  ["bondik", "dAT", 0.58, 45],
  ["ub1que", "dAT", 0.53, 45],
  ["Polly", "London Conspiracy", 0.46, 39],
  ["MithilF", "Wolf", 0.45, 43],
  ["SPUNJ", "Vox Eminor", 0.40, 42],
  ["Skurk", "London Conspiracy", 0.33, 39],
  ["prb", "London Conspiracy", 0.30, 39],
  ["topguN", "Vox Eminor", 0.30, 42]
];

// Shrinkage
const PRIOR_ROUNDS = 120;
const shrunk = raw.map(([name, team, rating, rounds]) => ({
  name, team,
  sr: (rating * rounds + 1.00 * PRIOR_ROUNDS) / (rounds + PRIOR_ROUNDS),
}));

// Core Roles (MANDATORY ENUM ONLY: AWPER, ENTRY, RIFLER, IGL, SUPPORT)
const roles = {
  // NiP
  "f0rest": "AWPER", "GeT_RiGhT": "RIFLER", "friberg": "ENTRY", "Xizt": "IGL", "Fifflaren": "SUPPORT",
  // fnatic
  "JW": "AWPER", "pronax": "IGL", "flusha": "RIFLER", "KRIMZ": "SUPPORT", "olofmeister": "ENTRY",
  // Dignitas
  "device": "AWPER", "FeTiSh": "IGL", "dupreeh": "ENTRY", "Xyp9x": "SUPPORT", "aizy": "RIFLER",
  // LDLC
  "KQLY": "AWPER", "Happy": "IGL", "apEX": "ENTRY", "Maniac": "SUPPORT", "Uzzziii": "RIFLER",
  // Epsilon
  "fxy0": "AWPER", "shox": "RIFLER", "kioShiMa": "ENTRY", "GMX": "IGL", "Sf": "SUPPORT",
  // Virtus.pro
  "pashaBiceps": "AWPER", "TaZ": "IGL", "Snax": "RIFLER", "byali": "ENTRY", "NEO": "SUPPORT",
  // Cloud9
  "SEMPHIS": "AWPER", "seang@res": "IGL", "n0thing": "ENTRY", "Hiko": "RIFLER", "shroud": "RIFLER",
  // Natus Vincere
  "GuardiaN": "AWPER", "Zeus": "IGL", "Edward": "ENTRY", "seized": "RIFLER", "starix": "SUPPORT",
  // Titan
  "kennyS": "AWPER", "Ex6TenZ": "IGL", "ScreaM": "RIFLER", "SmithZz": "SUPPORT", "NBK-": "ENTRY",
  // HellRaisers
  "markeloff": "AWPER", "ANGE1": "IGL", "Dosia": "RIFLER", "AdreN": "ENTRY", "kUcheR": "SUPPORT",
  // CPH Wolves
  "Nico": "AWPER", "gla1ve": "IGL", "cajunb": "RIFLER", "karrigan": "SUPPORT", "Pimp": "RIFLER",
  // iBUYPOWER
  "Skadoodle": "AWPER", "DaZeD": "IGL", "swag": "RIFLER", "AZK": "SUPPORT", "steel": "ENTRY",
  // dAT
  "WorldEdit": "AWPER", "B1ad3": "IGL", "flamie": "ENTRY", "bondik": "RIFLER", "ub1que": "SUPPORT",
  // London Conspiracy
  "Polly": "AWPER", "prb": "IGL", "rain": "ENTRY", "RUBINO": "RIFLER", "Skurk": "SUPPORT",
  // Vox Eminor
  "topguN": "AWPER", "SPUNJ": "IGL", "Havoc": "SUPPORT", "AZR": "RIFLER", "jks": "RIFLER",
  // Wolf
  "RiTz": "AWPER", "RiX": "IGL", "Ace": "ENTRY", "astaRR": "RIFLER", "MithilF": "SUPPORT"
};

const FLEX = new Set([
  "f0rest", "GeT_RiGhT", "JW", "flusha", "olofmeister", "device", "dupreeh", "shox", "Snax", "pashaBiceps", "Hiko", "GuardiaN", "seized", "kennyS", "ScreaM", "cajunb", "swag", "flamie", "rain"
]);

// ── Team definitions (ordered roughly by placement 1-16) ──────────
const TEAMS = [
  { id: 33, name: "NiP", position: 1, icon: "/logos/nip.png" },
  { id: 34, name: "fnatic", position: 2, icon: "/logos/fnatic.png" },
  { id: 35, name: "Dignitas", position: 3, icon: "/logos/dignitas.png" },
  { id: 36, name: "LDLC", position: 4, icon: "/logos/ldlc.png" },
  { id: 37, name: "Epsilon", position: 5, icon: "/logos/epsilon.png" },
  { id: 38, name: "Virtus.pro", position: 6, icon: "/logos/vp.png" },
  { id: 39, name: "Cloud9", position: 7, icon: "/logos/c9.png" },
  { id: 40, name: "Natus Vincere", position: 8, icon: "/logos/navi.png" },
  { id: 41, name: "Titan", position: 9, icon: "/logos/titan.png" },
  { id: 42, name: "HellRaisers", position: 10, icon: "/logos/hellraisers.png" },
  { id: 43, name: "CPH Wolves", position: 11, icon: "/logos/cph.png" },
  { id: 44, name: "iBUYPOWER", position: 12, icon: "/logos/ibp.png" },
  { id: 45, name: "dAT", position: 13, icon: "/logos/dat.png" },
  { id: 46, name: "London Conspiracy", position: 14, icon: "/logos/lc.png" },
  { id: 47, name: "Vox Eminor", position: 15, icon: "/logos/vox.png" },
  { id: 48, name: "Wolf", position: 16, icon: "/logos/wolf.png" },
];

const playersByTeam = {};
shrunk.forEach(s => {
  if (!playersByTeam[s.team]) playersByTeam[s.team] = [];
  playersByTeam[s.team].push(s);
});

let globalPlayerId = 161; // Past the 160 from IDs 1-32 (32 * 5)
const cologneTeams = TEAMS.map(teamDef => {
  const teamPlayers = playersByTeam[teamDef.name];
  if (!teamPlayers) {
    console.error("No players found for team:", teamDef.name);
    process.exit(1);
  }

  const players = teamPlayers.map(p => {
    const role = roles[p.name] || "RIFLER";
    const stats = generatePlayerStats(p.name, role, p.sr);
    return {
      id: globalPlayerId++,
      name: p.name,
      role: role,
      ...stats,
      flex: FLEX.has(p.name),
    };
  });

  return {
    id: teamDef.id,
    name: teamDef.name,
    major: "ESL One Cologne 2014",
    position: teamDef.position,
    icon: teamDef.icon,
    players,
  };
});

const filePath = path.join(__dirname, '../src/data/teams.json');
let existingTeams = [];
try {
  const allTeams = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  existingTeams = allTeams.filter(t => t.id < 33 || t.id > 48);
} catch (e) {
  console.log("No existing teams.json found, creating from scratch.");
}

const combined = [...existingTeams, ...cologneTeams].sort((a,b)=>a.id - b.id);
fs.writeFileSync(filePath, JSON.stringify(combined, null, 2));

console.log("\nDone! Added 16 ESL One Cologne 2014 teams.");
console.log("Total teams in teams.json: " + combined.length);
