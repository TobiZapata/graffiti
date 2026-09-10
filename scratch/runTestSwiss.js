const { generateSwissPairings } = require('./testSwiss.js');

let teams = Array.from({ length: 16 }).map((_, i) => ({ id: `T${i}`, wins: 0, losses: 0 }));
let matches = [];
let round = 1;

while (true) {
  let active = teams.filter(t => t.wins < 3 && t.losses < 3);
  if (active.length === 0) break;
  
  let newMatches = generateSwissPairings(active, matches, round);
  newMatches.forEach(m => {
    // simulate
    m.winner = m.teamA.id; // just a deterministic win to see if it breaks
    let tA = teams.find(t => t.id === m.teamA.id);
    let tB = teams.find(t => t.id === m.teamB.id);
    tA.wins++;
    tB.losses++;
  });
  
  matches.push(...newMatches);
  
  // count pools
  let counts = {};
  teams.forEach(t => {
    let key = `${t.wins}-${t.losses}`;
    counts[key] = (counts[key] || 0) + 1;
  });
  console.log(`After Round ${round}:`, counts);
  round++;
}
