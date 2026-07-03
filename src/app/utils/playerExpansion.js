export function expandPlayerStats(playerData, assignedRole = null) {
  // If the player already has specific stats (like from spirit.js), return as is, just update role if assigned
  if (playerData.aim !== undefined) {
    return {
      ...playerData,
      role: assignedRole ? assignedRole.toUpperCase() : playerData.role,
    };
  }

  // If the player comes from teams.json, they only have `rating` and `rol1`
  const base = playerData.rating || 80;
  const role = assignedRole ? assignedRole.toUpperCase() : (playerData.rol1 ? playerData.rol1.toUpperCase() : "RIFLER");

  // Add a slight randomization around the base rating for variety
  const randomize = (val, variance = 5) => Math.max(1, Math.min(99, val + Math.floor(Math.random() * variance * 2) - variance));

  return {
    name: playerData.name,
    role: role,
    aim: randomize(base),
    gamesense: randomize(base),
    positioning: randomize(base),
    utility: randomize(base),
    clutch: randomize(base),
    entry: randomize(base + (role === 'ENTRY' ? 10 : 0)), // Boost entry stat if role is ENTRY
    aggression: randomize(base + (role === 'ENTRY' ? 10 : (role === 'AWPER' ? -10 : 0))),
    composure: randomize(base),
    isAwper: role === 'AWPER' || playerData.rol1 === 'awper' || playerData.rol2 === 'awper'
  };
}

export function formatTeamForSimulation(team, squad = null) {
  if (team.isPlayer && squad) {
    // For the player's team, use the drafted squad
    return {
      name: team.name,
      icon: team.icon,
      players: squad.map(s => expandPlayerStats(s.player, s.assignedRole))
    };
  }
  
  // For AI teams
  return {
    name: team.name,
    icon: team.icon,
    players: team.players.map(p => expandPlayerStats(p))
  };
}
