export function generateSwissPairings(activeTeams, pastMatches, roundNumber) {
  const played = new Set();
  pastMatches.forEach(m => {
    if (m.teamA && m.teamB) {
      played.add(`${m.teamA.id}-${m.teamB.id}`);
      played.add(`${m.teamB.id}-${m.teamA.id}`);
    }
  });

  // Agrupar por record (ej. "2-1")
  const buckets = {};
  activeTeams.forEach(t => {
    const key = `${t.wins}-${t.losses}`;
    if (!buckets[key]) buckets[key] = [];
    buckets[key].push(t);
  });

  const pairings = [];

  // Resolver cada bucket por separado para evitar que crucen a otro score
  Object.keys(buckets).sort((a, b) => {
    // Sort buckets by wins descending, then losses ascending
    const [wA, lA] = a.split('-').map(Number);
    const [wB, lB] = b.split('-').map(Number);
    return wB - wA || lA - lB;
  }).forEach(key => {
    const teamList = buckets[key];
    
    // Backtracking para encontrar emparejamientos sin repetir rival
    function findPairing(teams) {
      if (teams.length === 0) return [];
      if (teams.length % 2 !== 0) return null; // No deber??a pasar si los pools son pares

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

    // Fallback: Si no hay forma matem??tica de emparejar sin repetir (raro pero posible),
    // o si el pool qued?? impar (en caso de bug externo), hacemos emparejamiento codicioso
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
    completed: false,
    isPlayerMatch: pair[0].isPlayer || pair[1].isPlayer
  }));
}
