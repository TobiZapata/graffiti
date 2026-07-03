const fs = require('fs');
const path = require('path');

const teamsPath = path.join(__dirname, '../src/data/teams.json');
const teams = JSON.parse(fs.readFileSync(teamsPath, 'utf8'));

function expandPlayerStats(playerData) {
  if (playerData.aim !== undefined) {
    return playerData;
  }
  const base = playerData.rating || 80;
  const role = playerData.rol1 ? playerData.rol1.toUpperCase() : "RIFLER";

  const randomize = (val, variance = 3) => Math.max(1, Math.min(99, val + Math.floor(Math.random() * variance * 2) - variance));

  return {
    id: playerData.id,
    name: playerData.name,
    role: role,
    aim: randomize(base),
    gamesense: randomize(base),
    positioning: randomize(base),
    utility: randomize(base),
    clutch: randomize(base),
    entry: randomize(base + (role === 'ENTRY' ? 10 : 0)),
    aggression: randomize(base + (role === 'ENTRY' ? 10 : (role === 'AWPER' ? -10 : 0))),
    composure: randomize(base),
    flex: playerData.flex
  };
}

const updatedTeams = teams.map(team => {
  return {
    ...team,
    players: team.players.map(p => expandPlayerStats(p))
  };
});

fs.writeFileSync(teamsPath, JSON.stringify(updatedTeams, null, 2));
console.log("Updated teams.json");
