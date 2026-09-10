// ──────────────────────────────────────────────────────────────────────
// DreamHack Winter 2013 — 16 teams, IDs 1-16
// Stats generated with Advanced Organic Methodology (v3)
// ──────────────────────────────────────────────────────────────────────
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ── Raw HLTV data: [name, team, rating, rounds] ─────────────────────
const raw = [
  // fnatic
  ["JW",          "fnatic",              1.26, 243],
  ["znajder",     "fnatic",              1.20, 243],
  ["flusha",      "fnatic",              1.19, 243],
  ["Devilwalk",   "fnatic",              0.91, 243],
  ["pronax",      "fnatic",              0.91, 243],
  // NiP
  ["f0rest",      "NiP",                 1.13, 269],
  ["GeT_RiGhT",   "NiP",                1.11, 269],
  ["friberg",     "NiP",                 1.10, 269],
  ["Xizt",        "NiP",                 1.01, 269],
  ["Fifflaren",   "NiP",                 0.96, 269],
  // VeryGames
  ["SmithZz",     "VeryGames",           1.11, 222],
  ["shox",        "VeryGames",           1.08, 222],
  ["Ex6TenZ",     "VeryGames",           0.97, 222],
  ["NBK-",        "VeryGames",           0.93, 222],
  ["ScreaM",      "VeryGames",           0.92, 222],
  // LGB
  ["dennis",      "LGB",                 1.16, 155],
  ["olofmeister", "LGB",                 1.04, 155],
  ["SKYTTEN",     "LGB",                 1.03, 155],
  ["Maikelele",   "LGB",                 1.02, 155],
  ["KRIMZ",       "LGB",                 0.92, 155],
  // Complexity
  ["Hiko",        "Complexity",          1.21, 173],
  ["n0thing",     "Complexity",          1.10, 173],
  ["SEMPHIS",     "Complexity",          1.08, 173],
  ["swag",        "Complexity",          0.92, 173],
  ["seang@res",   "Complexity",          0.76, 173],
  // Recursive
  ["Maniac",      "Recursive",           1.10, 162],
  ["Happy",       "Recursive",           1.08, 162],
  ["kennyS",      "Recursive",           0.93, 162],
  ["GMX",         "Recursive",           0.91, 162],
  ["Uzzziii",     "Recursive",           0.86, 162],
  // Astana Dragons
  ["AdreN",       "Astana Dragons",      1.07, 155],
  ["markeloff",   "Astana Dragons",      1.03, 155],
  ["Dosia",       "Astana Dragons",      1.01, 155],
  ["ANGEL",       "Astana Dragons",      0.96, 155],
  ["kUcheR",      "Astana Dragons",      0.80, 155],
  // CPH Wolves
  ["Xyp9x",       "CPH Wolves",         1.18, 121],
  ["Nico",        "CPH Wolves",          1.14, 121],
  ["dupreeh",     "CPH Wolves",          1.04, 121],
  ["FeTiSh",      "CPH Wolves",          0.99, 121],
  ["device",      "CPH Wolves",          0.90, 121],
  // Reason
  ["COLON",       "Reason",              1.25,  75],
  ["EXR",         "Reason",              1.05,  75],
  ["smF",         "Reason",              0.87,  75],
  ["MSL",         "Reason",              0.83,  75],
  ["LOMME",       "Reason",              0.83,  75],
  // Universal Soldiers
  ["Snax",        "Universal Soldiers",  1.22,  74],
  ["pashaBiceps", "Universal Soldiers",  1.03,  74],
  ["NEO",         "Universal Soldiers",  0.99,  74],
  ["byali",       "Universal Soldiers",  0.87,  74],
  ["TaZ",         "Universal Soldiers",  0.72,  74],
  // n!faculty
  ["raalz",       "n!faculty",           1.01,  67],
  ["karrigan",    "n!faculty",           0.92,  67],
  ["gla1ve",      "n!faculty",           0.85,  67],
  ["Pimp",        "n!faculty",           0.84,  67],
  ["cajunb",      "n!faculty",           0.82,  67],
  // Clan-Mystik
  ["apEX",        "Clan-Mystik",         1.01,  70],
  ["KQLY",        "Clan-Mystik",         1.01,  70],
  ["kioShiMa",    "Clan-Mystik",         0.74,  70],
  ["ioRek",       "Clan-Mystik",         0.60,  70],
  ["HaRts",       "Clan-Mystik",         0.59,  70],
  // iBUYPOWER
  ["DaZeD",       "iBUYPOWER",           0.93,  49],
  ["anger",       "iBUYPOWER",           0.80,  49],
  ["AZK",         "iBUYPOWER",           0.79,  49],
  ["Skadoodle",   "iBUYPOWER",           0.76,  49],
  ["adreN",       "iBUYPOWER",           0.72,  49],
  // Xapso
  ["cadiaN",      "Xapso",               1.10,  45],
  ["aizy",        "Xapso",               0.92,  45],
  ["centeks",     "Xapso",               0.78,  45],
  ["ultra",       "Xapso",               0.65,  45],
  ["robiin",      "Xapso",               0.40,  45],
  // SK
  ["twist",       "SK",                  1.06,  46],
  ["Delpan",      "SK",                  0.89,  46],
  ["pita",        "SK",                  0.62,  46],
  ["xelos",       "SK",                  0.54,  46],
  ["MODDII",      "SK",                  0.51,  46],
  // Natus Vincere
  ["seized",      "Natus Vincere",       1.18,  54],
  ["ceh9",        "Natus Vincere",       0.82,  54],
  ["Zeus",        "Natus Vincere",       0.74,  54],
  ["tonyblack",   "Natus Vincere",       0.60,  54],
  ["starix",      "Natus Vincere",       0.52,  54],
];

// ── Step 1: Bayesian shrinkage ──────────────────────────────────────
const PRIOR_ROUNDS = 120;
const shrunk = raw.map(([name, team, rating, rounds]) => ({
  name, team,
  sr: (rating * rounds + 1.00 * PRIOR_ROUNDS) / (rounds + PRIOR_ROUNDS),
}));

// ── Step 2: Global mapping curve (aligned with Katowice 2014) ───────
shrunk.forEach(s => {
  s.base = Math.round(71 + (s.sr - 1.00) * 68);
});

// ── Step 3: Core roles (MANDATORY ENUM ONLY: AWPER, ENTRY, RIFLER, IGL, SUPPORT) 
const roles = {
  "JW": "AWPER", "znajder": "RIFLER", "flusha": "RIFLER", "Devilwalk": "SUPPORT", "pronax": "IGL",
  "f0rest": "RIFLER", "GeT_RiGhT": "RIFLER", "friberg": "ENTRY", "Xizt": "IGL", "Fifflaren": "SUPPORT",
  "SmithZz": "AWPER", "shox": "RIFLER", "Ex6TenZ": "IGL", "NBK-": "SUPPORT", "ScreaM": "RIFLER",
  "dennis": "RIFLER", "olofmeister": "RIFLER", "SKYTTEN": "RIFLER", "Maikelele": "AWPER", "KRIMZ": "SUPPORT",
  "Hiko": "RIFLER", "n0thing": "RIFLER", "SEMPHIS": "ENTRY", "swag": "RIFLER", "seang@res": "IGL",
  "Maniac": "IGL", "Happy": "RIFLER", "kennyS": "AWPER", "GMX": "ENTRY", "Uzzziii": "SUPPORT",
  "AdreN": "IGL", "markeloff": "AWPER", "Dosia": "RIFLER", "ANGEL": "RIFLER", "kUcheR": "SUPPORT",
  "Xyp9x": "SUPPORT", "Nico": "RIFLER", "dupreeh": "ENTRY", "FeTiSh": "IGL", "device": "AWPER",
  "COLON": "RIFLER", "EXR": "RIFLER", "smF": "RIFLER", "MSL": "IGL", "LOMME": "SUPPORT",
  "Snax": "RIFLER", "pashaBiceps": "ENTRY", "NEO": "IGL", "byali": "RIFLER", "TaZ": "SUPPORT",
  "raalz": "RIFLER", "karrigan": "IGL", "gla1ve": "RIFLER", "Pimp": "RIFLER", "cajunb": "AWPER",
  "apEX": "ENTRY", "KQLY": "RIFLER", "kioShiMa": "RIFLER", "ioRek": "SUPPORT", "HaRts": "IGL",
  "DaZeD": "IGL", "anger": "ENTRY", "AZK": "RIFLER", "Skadoodle": "AWPER", "adreN": "SUPPORT",
  "cadiaN": "AWPER", "aizy": "RIFLER", "centeks": "RIFLER", "ultra": "SUPPORT", "robiin": "RIFLER",
  "twist": "RIFLER", "Delpan": "AWPER", "pita": "IGL", "xelos": "RIFLER", "MODDII": "ENTRY",
  "seized": "RIFLER", "ceh9": "ENTRY", "Zeus": "IGL", "tonyblack": "SUPPORT", "starix": "AWPER",
};

// ── Step 4: Robust Role Offsets ─────────────────────────────────────
// More pronounced differences between roles so stats aren't flat.
// [aim, gamesense, positioning, utility, clutch, entry, aggression, composure]
const ROLE_OFFSETS = {
  AWPER:   [+4, +1, +3, -3, +1, -3, -5, +2],
  ENTRY:   [+3, -2, -2, -2, -2, +7, +7, -2],
  IGL:     [-5, +7, +2, +5, +0, -4, -4, +3],
  SUPPORT: [-3, +3, +2, +6, +2, -5, -5, +1],
  RIFLER:  [+2, +0, +1, +0, +1, +1, +1, +0], // Base Rifler. Signatures + Noise will shape them.
};

// ── Step 5: Legendary Signatures ────────────────────────────────────
// Famous players get complete archetype overlays (even if their role is just 'RIFLER').
// This creates "Lurkers", "Stars", "Anchors" internally without breaking the 5-role UI.
const SIGNATURES = {
  // Suecia
  "JW":          [+0, +0, +0, -2, +2, +3, +8, +0], // El AWPer más agresivo
  "flusha":      [+0, +7, +3, +4, +6, -3, -3, +4], // Señor VAC (GS, spam de humo, clutch) -> Lurker interno
  "GeT_RiGhT":   [+2, +6, +5, +1, +6, -3, -3, +5], // Lurker legendario, clutch god
  "f0rest":      [+6, +1, +1, +0, +2, +3, +2, +3], // Aim puro, talento natural
  "olofmeister": [+3, +2, +2, +2, +4, +3, +2, +4], // El jugador más completo
  "KRIMZ":       [+0, +4, +5, +3, +4, -1, -2, +5], // Roca defensiva (Anchor interno)
  
  // Francia/Bélgica
  "ScreaM":      [+8, -2, +0, -2, +1, +3, +1, +0], // The Headshot Machine
  "shox":        [+4, +4, +1, +0, +6, +2, +2, +4], // Clutch god, magia pura
  "kennyS":      [+7, +0, +0, -2, +4, +3, +5, -2], // Velocidad de AWP inigualable
  "apEX":        [+0, +0, +0, +0, +0, +5, +7, -2], // Entry kamikaze
  "Ex6TenZ":     [-3, +4, +2, +4, +0, +0, +0, +2], // Mente maestra táctica
  
  // Dinamarca
  "Xyp9x":       [-2, +5, +4, +5, +8, -4, -4, +7], // The Clutch Minister
  "device":      [+4, +4, +4, +0, +2, +0, -2, +4], // AWP súper consistente y seguro
  "dupreeh":     [+2, +0, +0, +0, +0, +5, +5, +0], // Entry incansable
  
  // Polonia
  "Snax":        [+2, +7, +4, +3, +6, -1, -3, +5], // Inteligencia pura, ninja
  "pashaBiceps": [+2, +0, +0, +0, +3, +2, +2, +2], // AWP/Rifler híbrido
  "NEO":         [+0, +5, +3, +0, +4, +0, +0, +3], // Experiencia 1.6
  
  // CIS
  "markeloff":   [+4, +0, +2, +0, +0, +0, +0, +0], // Leyenda del AWP 1.6
  
  // NA
  "Hiko":        [+1, +4, +3, +0, +7, -3, -4, +5], // Lurk y Clutch NA
  "swag":        [+3, +5, +2, +0, +3, +0, +0, +2], // Talento prodigio, gs
};

const FLEX = new Set([
  "JW", "znajder", "flusha", "f0rest", "GeT_RiGhT", "shox", "NBK-", "dennis", "olofmeister",
  "Hiko", "n0thing", "swag", "Happy", "markeloff", "Dosia", "Xyp9x", "Nico", "dupreeh", "device",
  "Snax", "NEO", "TaZ", "cajunb", "KQLY", "kioShiMa", "aizy", "twist", "seized",
]);

// ── Step 6: Organic Noise Generator ─────────────────────────────────
// Adds a deterministic -2 to +2 to every stat so nobody has perfectly flat stats.
function getNoise(name, statIndex) {
  const hash = crypto.createHash('md5').update(name + statIndex).digest('hex');
  const num = parseInt(hash.substring(0, 4), 16);
  return (num % 5) - 2; // -2, -1, 0, 1, 2
}

const clip = (v) => Math.max(41, Math.min(96, v));

function computeStats(name, base) {
  const role = roles[name];
  const offsets = ROLE_OFFSETS[role];
  const sig = SIGNATURES[name] || [0,0,0,0,0,0,0,0];

  const statIndices = [0,1,2,3,4,5,6,7];
  const stats = statIndices.map(i => {
    return clip(base + offsets[i] + sig[i] + getNoise(name, i));
  });

  return {
    aim: stats[0], gamesense: stats[1], positioning: stats[2], utility: stats[3],
    clutch: stats[4], entry: stats[5], aggression: stats[6], composure: stats[7],
  };
}

// ── Team definitions (ordered by final placement) ───────────────────
const TEAMS = [
  { id:  1, name: "fnatic",             position:  1, icon: "/logos/fnatic.png" },
  { id:  2, name: "NiP",                position:  2, icon: "/logos/nip.png" },
  { id:  3, name: "VeryGames",          position:  3, icon: "/logos/verygames.png" },
  { id:  4, name: "LGB",                position:  4, icon: "/logos/lgb.png" },
  { id:  5, name: "Complexity",         position:  5, icon: "/logos/complexity.png" },
  { id:  6, name: "Recursive",          position:  6, icon: "/logos/recursive.png" },
  { id:  7, name: "Astana Dragons",     position:  7, icon: "/logos/astana.png" },
  { id:  8, name: "CPH Wolves",         position:  8, icon: "/logos/cph.png" },
  { id:  9, name: "Reason",             position:  9, icon: "/logos/reason.png" },
  { id: 10, name: "Universal Soldiers", position: 10, icon: "/logos/universal.png" },
  { id: 11, name: "n!faculty",          position: 11, icon: "/logos/nfaculty.png" },
  { id: 12, name: "Clan-Mystik",        position: 12, icon: "/logos/mystik.png" },
  { id: 13, name: "iBUYPOWER",          position: 13, icon: "/logos/ibp.png" },
  { id: 14, name: "Xapso",              position: 14, icon: "/logos/xapso.png" },
  { id: 15, name: "SK",                 position: 15, icon: "/logos/sk.png" },
  { id: 16, name: "Natus Vincere",      position: 16, icon: "/logos/navi.png" },
];

// Map players to their team
const playersByTeam = {};
shrunk.forEach(s => {
  if (!playersByTeam[s.team]) playersByTeam[s.team] = [];
  playersByTeam[s.team].push(s);
});

// Build team objects
let globalPlayerId = 1;
const dh2013Teams = TEAMS.map(teamDef => {
  const teamPlayers = playersByTeam[teamDef.name];
  if (!teamPlayers) {
    console.error("No players found for team:", teamDef.name);
    process.exit(1);
  }

  const players = teamPlayers.map(p => {
    const stats = computeStats(p.name, p.base);
    return {
      id: globalPlayerId++,
      name: p.name,
      role: roles[p.name],
      ...stats,
      flex: FLEX.has(p.name),
    };
  });

  return {
    id: teamDef.id,
    name: teamDef.name,
    major: "DreamHack Winter 2013",
    position: teamDef.position,
    icon: teamDef.icon,
    players,
  };
});

// ── Combine with existing teams ─────────────────────────────────────
const filePath = path.join(__dirname, '../src/data/teams.json');
let existingTeams = [];
try {
  const allTeams = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  existingTeams = allTeams.filter(t => t.id >= 17);
} catch (e) {
  console.log("No existing teams.json found, creating from scratch.");
}

const combined = [...dh2013Teams, ...existingTeams];
fs.writeFileSync(filePath, JSON.stringify(combined, null, 2));

console.log("\nDone! Regenerated 16 DreamHack Winter 2013 teams with advanced organic methodology.");
console.log("Total teams in teams.json: " + combined.length);
