const fs = require('fs');
const path = require('path');

const teamsPath = path.join(__dirname, '../src/data/teams.json');
const teams = JSON.parse(fs.readFileSync(teamsPath, 'utf8'));

// Delete existing FaZe (2018) just in case, or rename it.
// Let's keep it but rename it to "FaZe 2018".
const oldFaze = teams.find(t => t.name === "FaZe");
if (oldFaze) {
  oldFaze.name = "FaZe 2018";
}

const spiritPlayers = [
  { name: "donk", role: "ENTRY", aim: 99, gamesense: 88, positioning: 90, utility: 70, clutch: 82, entry: 99, aggression: 98, composure: 90 },
  { name: "sh1ro", role: "AWPER", aim: 95, gamesense: 95, positioning: 94, utility: 80, clutch: 96, entry: 40, aggression: 45, composure: 99 },
  { name: "zont1x", role: "SUPPORT", aim: 84, gamesense: 86, positioning: 84, utility: 91, clutch: 78, entry: 60, aggression: 60, composure: 83 },
  { name: "magixx", role: "RIFLER", aim: 88, gamesense: 84, positioning: 85, utility: 78, clutch: 82, entry: 70, aggression: 72, composure: 86 },
  { name: "chopper", role: "IGL", aim: 79, gamesense: 93, positioning: 85, utility: 90, clutch: 72, entry: 50, aggression: 55, composure: 84 }
];

const fazePlayers = [
  { name: "broky", role: "AWPER", aim: 93, gamesense: 91, positioning: 92, utility: 80, clutch: 90, entry: 40, aggression: 45, composure: 92 },
  { name: "frozen", role: "RIFLER", aim: 91, gamesense: 89, positioning: 91, utility: 82, clutch: 88, entry: 80, aggression: 75, composure: 90 },
  { name: "rain", role: "ENTRY", aim: 88, gamesense: 86, positioning: 86, utility: 80, clutch: 75, entry: 94, aggression: 92, composure: 87 },
  { name: "karrigan", role: "IGL", aim: 73, gamesense: 96, positioning: 88, utility: 93, clutch: 70, entry: 45, aggression: 55, composure: 85 },
  { name: "EliGE", role: "RIFLER", aim: 92, gamesense: 87, positioning: 88, utility: 78, clutch: 85, entry: 85, aggression: 84, composure: 88 }
];

let nextPlayerId = 30;

function formatTeam(id, name, icon, players) {
  return {
    id,
    name,
    major: "Modern",
    position: 1,
    icon,
    players: players.map(p => ({
      id: nextPlayerId++,
      flex: p.role !== "IGL", // Just a dummy flex value
      ...p
    }))
  };
}

const nextTeamId = Math.max(...teams.map(t => t.id)) + 1;
teams.push(formatTeam(nextTeamId, "Spirit", "/logos/spirit.png", spiritPlayers));
teams.push(formatTeam(nextTeamId + 1, "FaZe", "/logos/faze.png", fazePlayers));

fs.writeFileSync(teamsPath, JSON.stringify(teams, null, 2));
console.log("Added Spirit and Modern FaZe to teams.json");
