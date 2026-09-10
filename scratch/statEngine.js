const crypto = require('crypto');

// 1. ROLES AMPLIADOS Y OFFSETS MÁS AGRESIVOS
// Array: [aim, gamesense, positioning, utility, clutch, entry, aggression, composure]
const ROLE_OFFSETS = {
  AWPER:   [+4, +1, +3, -2, +1, -3, -5, +2],
  ENTRY:   [+3, -2, -2, -2, -2, +7, +7, -2],
  IGL:     [-5, +7, +2, +5, +0, -4, -4, +3],
  SUPPORT: [-3, +3, +2, +6, +2, -5, -5, +1],
  LURKER:  [+1, +5, +5, +2, +5, -5, -6, +2], // Ej: GeT_RiGhT, flusha, Snax
  STAR:    [+4, +3, +2, +0, +3, +3, +3, +3], // Riflers estrella/playmakers, ej: f0rest, shox
  RIFLER:  [+1, +1, +1, +1, +1, +1, +1, +1], // Rifler genérico, el noise le dará forma
};

// 2. FIRMAS DE JUGADORES HISTÓRICOS (Para dar el toque final)
// [aim, gs, pos, util, clutch, entry, aggr, comp]
const SIGNATURES = {
  // Suecia
  "JW":          [+0, +0, +0, +0, +0, +2, +6, +0], // El AWPer más agresivo
  "flusha":      [+0, +6, +0, +3, +5, +0, +0, +3], // Señor VAC (GS, spam de humo, clutch)
  "GeT_RiGhT":   [+0, +5, +4, +0, +5, -2, -2, +4], // Lurker legendario, clutch god
  "f0rest":      [+4, +0, +0, +0, +0, +0, +0, +2], // Aim puro, talento natural
  "olofmeister": [+2, +2, +2, +2, +4, +2, +0, +4], // El jugador más completo
  "KRIMZ":       [+0, +4, +4, +3, +4, +0, +0, +5], // Roca defensiva
  "dennis":      [+4, +0, +0, +0, +0, +2, +3, +0], // Pistolas y aim bruto
  "znajder":     [+3, +0, +0, +0, +0, +0, +0, +0], // Gran aim bruto
  
  // Francia/Bélgica
  "ScreaM":      [+7, -2, +0, -2, +0, +2, +0, +0], // The Headshot Machine
  "shox":        [+2, +3, +0, +0, +5, +0, +0, +3], // Clutch god, magia pura
  "kennyS":      [+6, +0, +0, +0, +3, +2, +3, -2], // Velocidad de AWP inigualable
  "apEX":        [+0, +0, +0, +0, +0, +5, +6, -2], // El entry por excelencia
  "Ex6TenZ":     [-3, +4, +2, +4, +0, +0, +0, +2], // Mente maestra táctica
  
  // Dinamarca
  "Xyp9x":       [-2, +4, +3, +3, +7, -2, -2, +6], // The Clutch Minister
  "device":      [+4, +3, +3, +0, +0, +0, -2, +2], // AWP súper consistente y seguro
  "dupreeh":     [+2, +0, +0, +0, +0, +5, +5, +0], // Entry agresivo incansable
  "gla1ve":      [+0, +5, +2, +5, +0, +2, +2, +3], // IGL que hace mucho daño y humo
  
  // Polonia
  "Snax":        [+2, +6, +4, +2, +5, +0, -3, +4], // Inteligencia pura, ninja
  "pashaBiceps": [+2, +0, +0, +0, +3, +2, +2, +2], // AWP/Rifler híbrido
  "NEO":         [+0, +4, +2, +0, +4, +0, +0, +3], // Experiencia 1.6
  "TaZ":         [-2, +2, +0, +0, +2, +0, +0, +5], // Liderazgo emocional
  
  // CIS
  "markeloff":   [+4, +0, +2, +0, +0, +0, +0, +0], // Leyenda del AWP 1.6
  "Zeus":        [-4, +4, +0, +2, +0, -2, -2, +4], // IGL carismático
  "Dosia":       [+0, +3, +0, +2, +0, +0, +0, +0], // X GOD
  "GuardiaN":    [+6, +2, +2, -2, +4, +2, +1, +2], // Flick god, AWP muy rápido
  "Edward":      [+3, +0, +0, +0, +2, +4, +3, +1], // Pistol King
  "B1ad3":       [-6, +8, +3, +6, +0, -4, -5, +2], // Mente maestra táctica CIS, bajo aim
  
  // NA
  "Hiko":        [+0, +3, +2, +0, +6, -3, -3, +4], // Lurk y Clutch NA
  "swag":        [+3, +4, +0, +0, +2, +0, +0, +2], // Talento prodigio, gs
  "n0thing":     [+2, +0, +0, +0, +0, +2, +2, +0], // Aim y espontaneidad
  "shroud":      [+5, -2, +1, +0, +2, +0, +0, -1], // Rey de Reddit, Aim altísimo
  
  // Otros
  "rain":        [+3, +2, +2, +1, +4, +5, +4, +6], // Entry hiper-calmado (Ice cold)
};

// 3. GENERADOR DETERMINISTA DE RUIDO
// Agrega -3 a +3 basado en el nombre y stat, para que nadie quede plano.
function getNoise(name, statName, range = 3) {
  const hash = crypto.createHash('md5').update(name + statName).digest('hex');
  const num = parseInt(hash.substring(0, 4), 16);
  return (num % (range * 2 + 1)) - range;
}

const STAT_NAMES = ['aim', 'gamesense', 'positioning', 'utility', 'clutch', 'entry', 'aggression', 'composure'];

const clip = (v) => Math.max(41, Math.min(96, v));

function generatePlayerStats(name, role, shrunkRating) {
  // Curva global (estilo Katowice 2014)
  const base = Math.round(71 + (shrunkRating - 1.00) * 68);
  
  // Role offsets (si el rol no existe, usar RIFLER)
  const offsets = ROLE_OFFSETS[role] || ROLE_OFFSETS['RIFLER'];
  
  // Signature offsets
  const sig = SIGNATURES[name] || [0,0,0,0,0,0,0,0];

  const stats = {};
  
  STAT_NAMES.forEach((stat, i) => {
    // Calculo: Base + Rol + Firma + Noise (±3)
    let val = base + offsets[i] + sig[i] + getNoise(name, stat);
    stats[stat] = clip(val);
  });

  return stats;
}

module.exports = {
  generatePlayerStats,
  ROLE_OFFSETS,
  SIGNATURES
};
