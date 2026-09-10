import { formatTeamForSimulation } from "@/app/utils/playerExpansion";
import { getTeamsFromDB } from "./teamService";

// Helper function to generate scores for NPC matches
export function generateScore() {
  const roll = Math.random();
  let winnerScore, loserScore;

  if (roll < 0.20) {
    const otRounds = Math.random() < 0.7 ? 1 : 2; 
    winnerScore = 13 + otRounds * 3;
    loserScore = winnerScore - 2; 
  } else if (roll < 0.45) {
    winnerScore = 13;
    loserScore = 10 + Math.floor(Math.random() * 3); 
  } else if (roll < 0.75) {
    winnerScore = 13;
    loserScore = 6 + Math.floor(Math.random() * 4); 
  } else {
    winnerScore = 13;
    loserScore = 2 + Math.floor(Math.random() * 4); 
  }
  return { winnerScore, loserScore };
}

// Generate the initial tournament state
export async function initializeMultiplayerTournament(roomPlayers) {
  const allDbTeams = await getTeamsFromDB();
  
  // Format human players
  const humanTeams = roomPlayers.map((p, i) => ({
    id: `player_${p.uid}`,
    isPlayer: true,
    uid: p.uid,
    playerName: p.name,
    wins: 0,
    losses: 0,
    ...formatTeamForSimulation({ name: p.teamName || p.name, isPlayer: true, icon: p.icon || "/logos/faze.png" }, p.squad)
  }));

  // Fill remaining slots with NPCs to reach 16 teams
  let otherTeams = [...allDbTeams].sort(() => Math.random() - 0.5);
  const neededNPCs = 16 - humanTeams.length;
  
  while (otherTeams.length < neededNPCs) {
    otherTeams.push(...[...allDbTeams].sort(() => Math.random() - 0.5));
  }
  otherTeams = otherTeams.slice(0, neededNPCs);

  const npcTeams = otherTeams.map((t, i) => ({
    id: `npc_${t.id}_${i}`,
    isPlayer: false,
    wins: 0,
    losses: 0,
    ...formatTeamForSimulation(t)
  }));

  const standings = [...humanTeams, ...npcTeams];

  // Generate round 1 matches
  const sorted = [...standings].sort(() => Math.random() - 0.5);
  const matches = [];
  
  for (let i = 0; i < sorted.length; i += 2) {
    matches.push({
      id: `R1_M${i/2}`,
      round: 1,
      teamA: sorted[i],
      teamB: sorted[i + 1],
      result: null,
      isPlayerMatch: sorted[i].isPlayer || sorted[i + 1].isPlayer,
      playerUids: [sorted[i].uid, sorted[i+1].uid].filter(Boolean), // Track humans in this match
      completed: false,
    });
  }

  return {
    stage: "swiss",
    swissRound: 1,
    standings,
    matches
  };
}

// Generate swiss pairings avoiding rematches when possible
export function generateSwissPairings(activeTeams, pastMatches, roundNumber) {
  const played = new Set();
  pastMatches.forEach(m => {
    if (m.teamA && m.teamB) {
      played.add(`${m.teamA.id}-${m.teamB.id}`);
      played.add(`${m.teamB.id}-${m.teamA.id}`);
    }
  });

  const buckets = {};
  activeTeams.forEach(t => {
    const key = `${t.wins}-${t.losses}`;
    if (!buckets[key]) buckets[key] = [];
    buckets[key].push(t);
  });

  const pairings = [];

  Object.keys(buckets).sort((a, b) => {
    const [wA, lA] = a.split('-').map(Number);
    const [wB, lB] = b.split('-').map(Number);
    return wB - wA || lA - lB;
  }).forEach(key => {
    const teamList = buckets[key];
    
    function findPairing(teams) {
      if (teams.length === 0) return [];
      if (teams.length % 2 !== 0) return null;

      const t1 = teams[0];
      for (let i = 1; i < teams.length; i++) {
        const t2 = teams[i];
        if (!played.has(`${t1.id}-${t2.id}`)) {
          const rest = teams.filter(t => t.id !== t1.id && t.id !== t2.id);
          const subPairing = findPairing(rest);
          if (subPairing !== null) {
            return [[t1, t2], ...subPairing];
          }
        }
      }
      return null;
    }

    let bucketPairing = findPairing(teamList);

    if (!bucketPairing) {
      bucketPairing = [];
      const used = new Set();
      for (let i = 0; i < teamList.length; i++) {
        if (used.has(teamList[i].id)) continue;
        for (let j = i + 1; j < teamList.length; j++) {
          if (!used.has(teamList[j].id)) {
            bucketPairing.push([teamList[i], teamList[j]]);
            used.add(teamList[i].id);
            used.add(teamList[j].id);
            break;
          }
        }
      }
    }

    pairings.push(...bucketPairing);
  });

  return pairings.map((pair, idx) => ({
    id: `R${roundNumber}_M${pair[0].id}_${pair[1].id}_${idx}`,
    round: roundNumber,
    teamA: pair[0],
    teamB: pair[1],
    result: null,
    isPlayerMatch: pair[0].isPlayer || pair[1].isPlayer,
    playerUids: [pair[0].uid, pair[1].uid].filter(Boolean),
    completed: false,
  }));
}
