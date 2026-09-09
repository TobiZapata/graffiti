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
    ...formatTeamForSimulation({ name: p.teamName || p.name, isPlayer: true, icon: "/logos/faze.png" }, p.squad)
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

  const sorted = [...activeTeams].sort((a, b) => b.wins - a.wins || a.losses - b.losses);
  const pairings = [];
  const used = new Set();

  for (let i = 0; i < sorted.length; i++) {
    if (used.has(sorted[i].id)) continue;
    let paired = false;
    
    // Find the next available team with similar record that we haven't played
    for (let j = i + 1; j < sorted.length; j++) {
      if (!used.has(sorted[j].id) && !played.has(`${sorted[i].id}-${sorted[j].id}`)) {
        pairings.push([sorted[i], sorted[j]]);
        used.add(sorted[i].id);
        used.add(sorted[j].id);
        paired = true;
        break;
      }
    }
    
    // Fallback: If no unplayed team is available, pair with closest available team
    if (!paired) {
       for (let j = i + 1; j < sorted.length; j++) {
         if (!used.has(sorted[j].id)) {
            pairings.push([sorted[i], sorted[j]]);
            used.add(sorted[i].id);
            used.add(sorted[j].id);
            break;
         }
       }
    }
  }

  return pairings.map((pair, index) => ({
    id: `R${roundNumber}_M${index}`,
    round: roundNumber,
    teamA: pair[0],
    teamB: pair[1],
    result: null,
    isPlayerMatch: pair[0].isPlayer || pair[1].isPlayer,
    playerUids: [pair[0].uid, pair[1].uid].filter(Boolean),
    completed: false,
  }));
}
