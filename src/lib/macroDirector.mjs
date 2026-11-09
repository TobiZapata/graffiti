import seedrandom from 'seedrandom';
import { isV2Player, validateV2Player } from './playerModel.mjs';

const localUid = (player, index) => player.uid ?? String(index);
const playerStrength = p => (p.aim ?? p.rating ?? 80) * 0.5 + (p.positioning ?? p.rating ?? 80) * 0.3 + (p.composure ?? p.rating ?? 80) * 0.2;
const strength = team => team.players.reduce((sum, p, i) => sum + (isV2Player(p) ? (localUid(p, i) === team.mainAwperUid ? p.awp : p.rifler) : playerStrength(p)), 0) / 5;
const iglBonus = team => {
  const roles = team.players.filter(p => [p.role, p.rol1, p.rol2].some(role => typeof role === 'string' && role.toUpperCase() === 'IGL'));
  const igl = team.iglUid === undefined ? (roles.length === 1 ? roles[0] : undefined) : team.players.find((p, i) => localUid(p, i) === team.iglUid);
  // shortcut: leadership weights are game calibration; revisit after match balancing.
  return igl ? (isV2Player(igl) ? Math.max(-5, Math.min(5, (igl.igl - 70) * 0.1)) : ((igl.gamesense ?? igl.rating ?? 80) - 80) * 0.15) + (team.iglCompatibility ?? 0) * 3 : 0;
};

export const teamStrength = team => Math.max(1, strength(team) + iglBonus(team));
export const matchWinProbability = (teamA, teamB, engineVersion = 3) => {
  const powerA = teamStrength(teamA), powerB = teamStrength(teamB);
  if (engineVersion < 3) return powerA / (powerA + powerB);
  const difference = powerA - powerB;
  return 0.5 + Math.sign(difference) * Math.min(0.2, 0.1 * (Math.abs(difference) / 10) ** 1.5);
};

export function validateTeams(teamA, teamB) {
  for (const team of [teamA, teamB]) {
    if (!team || typeof team.name !== 'string' || !team.name.trim() || !Array.isArray(team.players) || team.players.length !== 5) {
      throw new Error('Cada equipo necesita un nombre y cinco jugadores');
    }
    const names = new Set(), uids = new Set();
    team.players.forEach((player, index) => {
      if (!player || typeof player.name !== 'string' || !player.name.trim() || names.has(player.name.trim())) throw new Error('Los nombres de jugadores deben ser únicos y no estar vacíos');
      names.add(player.name.trim());
      const uid = localUid(player, index);
      if (typeof uid !== 'string' || !uid.trim() || uids.has(uid.trim())) throw new Error('Los identificadores de jugadores deben ser únicos y no estar vacíos');
      uids.add(uid.trim());
      if (isV2Player(player)) validateV2Player(player);
      for (const stat of ['aim', 'positioning', 'composure', 'rating', 'gamesense']) {
        if (player[stat] !== undefined && (!Number.isFinite(player[stat]) || player[stat] < 1 || player[stat] > 100)) throw new Error(`Estadística de jugador inválida: ${stat}`);
      }
    });
    for (const field of ['iglUid', 'mainAwperUid']) {
      if (team[field] !== undefined && (typeof team[field] !== 'string' || !team.players.some((p, i) => localUid(p, i) === team[field]))) throw new Error(`Identificador inválido: ${field}`);
    }
    if (team.iglCompatibility !== undefined && (!Number.isFinite(team.iglCompatibility) || Math.abs(team.iglCompatibility) > 1)) throw new Error('Compatibilidad IGL inválida');
  }
  if (teamA.id !== undefined && teamB.id !== undefined ? teamA.id === teamB.id : teamA.name.trim() === teamB.name.trim()) throw new Error('Los equipos deben ser distintos');
}

export function createMacroDirector(teamA, teamB, seed = 'mirage-bo1', engineVersion = 3) {
  if (![1, 2, 3].includes(engineVersion)) throw new Error('Unsupported simulation version');
  validateTeams(teamA, teamB);
  if (!((typeof seed === 'string' && seed.trim()) || (typeof seed === 'number' && Number.isFinite(seed)))) throw new Error('La semilla debe ser un texto no vacío o un número finito');
  const winProbabilityA = matchWinProbability(teamA, teamB, engineVersion);
  const roundProbabilityA = Math.max(1, strength(teamA)) / (Math.max(1, strength(teamA)) + Math.max(1, strength(teamB)));
  const random = seedrandom(seed);
  const winnerTeam = random() < winProbabilityA ? 'A' : 'B';
  const loser = winnerTeam === 'A' ? 'B' : 'A';
  const targetScore = { A: 0, B: 0 };
  const finishAt = round => round <= 24 ? 13 : 13 + Math.floor((round - 25) / 6 + 1) * 3;
  while (true) {
    const round = targetScore.A + targetScore.B + 1, threshold = finishAt(round);
    const winner = random() < roundProbabilityA ? 'A' : 'B';
    targetScore[winner]++;
    if (targetScore[winner] >= threshold) break;
  }
  // Orient the sampled score shape to the already chosen winner without forcing ties.
  if (targetScore[winnerTeam] < targetScore[loser]) [targetScore.A, targetScore.B] = [targetScore.B, targetScore.A];
  const totalRounds = targetScore.A + targetScore.B;
  // shortcut: kill estimates and variance are provisional, calibrate against match data when available.
  const killTargets = engineVersion < 3 ? [teamA, teamB].flatMap((team, index) => {
    const v2 = team.players.some(isV2Player);
    const killRandom = seedrandom(`${typeof seed}:${seed}:kills:${index}`);
    const weights = v2 ? team.players.map(player => (0.2 + (isV2Player(player) ? player.firepower : playerStrength(player)) / 100) ** 1.5 * (0.5 + killRandom())) : [];
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    return team.players.map((player, i) => Object.freeze({
      playerUid: `${index ? 'B' : 'A'}:${localUid(player, i)}`, name: player.name, team: index ? 'B' : 'A',
      targetKills: Math.max(0, Math.round(v2 ? totalRounds * 3.25 * weights[i] / totalWeight : totalRounds * 0.65 * playerStrength(player) / 80 * (0.85 + random() * 0.3))),
    }));
  }) : undefined;
  // shortcut: map form is game calibration; tune its spread against observed scoreboard distributions.
  const playerTendencies = engineVersion >= 3 ? [teamA, teamB].flatMap((team, index) => {
    const formRandom = seedrandom(`${typeof seed}:${seed}:form:${index}`);
    return team.players.map((player, i) => Object.freeze({
      playerUid: `${index ? 'B' : 'A'}:${localUid(player, i)}`, name: player.name, team: index ? 'B' : 'A',
      protagonism: (0.2 + (isV2Player(player) ? player.firepower : playerStrength(player)) / 100) ** 1.5 * (0.65 + formRandom() * 0.7),
    }));
  }) : undefined;
  const plan = Object.freeze({ winnerTeam, winProbabilityA, targetScore: Object.freeze(targetScore),
    ...(engineVersion >= 3 ? { playerTendencies: Object.freeze(playerTendencies) } : { killTargets: Object.freeze(killTargets) }) });
  let scoreTeam1 = 0, scoreTeam2 = 0, done = false, pending;
  const context = () => {
    const round = scoreTeam1 + scoreTeam2 + 1;
    const overtime = round <= 24 ? 0 : Math.floor((round - 25) / 6) + 1;
    const half = overtime ? Math.floor((round - 25) % 6 / 3) + 1 : (round <= 12 ? 1 : 2);
    const teamASide = half === 1 ? 'T' : 'CT';
    const loserScore = loser === 'A' ? scoreTeam1 : scoreTeam2;
    const loserSide = loser === 'A' ? teamASide : (teamASide === 'T' ? 'CT' : 'T');
    const allowedWinnerSides = loserScore + 1 >= finishAt(round) ? [loserSide === 'T' ? 'CT' : 'T'] : ['T', 'CT'];
    return { round, teamASide, pistol: round === 1 || round === 13, overtime, half, allowedWinnerSides };
  };
  const peek = () => {
    if (done) throw new Error('El partido ya terminó');
    if (!pending) {
      const c = context();
      const remainingA = Math.max(0, targetScore.A - scoreTeam1), remainingB = Math.max(0, targetScore.B - scoreTeam2);
      const chanceA = remainingA + remainingB ? remainingA / (remainingA + remainingB) : (winnerTeam === 'A' ? 0.6 : 0.4);
      const choice = seedrandom(`${typeof seed}:${seed}:${scoreTeam1}:${scoreTeam2}`)() < chanceA ? 'A' : 'B';
      const winnerScore = winnerTeam === 'A' ? scoreTeam1 : scoreTeam2;
      const loserScore = loser === 'A' ? scoreTeam1 : scoreTeam2;
      const postpone = choice === winnerTeam && winnerScore + 1 >= finishAt(c.round) &&
        (loserScore < targetScore[loser] || targetScore[winnerTeam] > finishAt(c.round));
      const preferredTeam = postpone ? loser : choice;
      let side = preferredTeam === 'A' ? c.teamASide : (c.teamASide === 'T' ? 'CT' : 'T');
      if (!c.allowedWinnerSides.includes(side)) side = c.allowedWinnerSides[0];
      pending = Object.freeze({ ...c, allowedWinnerSides: Object.freeze(c.allowedWinnerSides), winnerSide: side, winnerTeam: side === c.teamASide ? 'A' : 'B' });
    }
    return pending;
  };
  return {
    plan,
    get scoreTeam1() { return scoreTeam1; },
    get scoreTeam2() { return scoreTeam2; },
    get done() { return done; },
    peek,
    next(winnerSide) {
      if (done) throw new Error('El partido ya terminó');
      if (winnerSide !== undefined && !context().allowedWinnerSides.includes(winnerSide)) throw new Error('Lado ganador no permitido');
      const c = peek();
      winnerSide ??= c.winnerSide;
      const observedWinner = winnerSide === c.teamASide ? 'A' : 'B';
      if (observedWinner === 'A') scoreTeam1++; else scoreTeam2++;
      done = (observedWinner === 'A' ? scoreTeam1 : scoreTeam2) >= finishAt(c.round);
      pending = undefined;
      return { ...c, winnerSide, winnerTeam: observedWinner };
    },
  };
}
