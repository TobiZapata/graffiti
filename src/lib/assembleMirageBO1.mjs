import seedrandom from 'seedrandom';
import { createMacroDirector } from './macroDirector.mjs';
import { createReplayEconomy, beginReplayRound, prepareReplayBuys, finishReplayRound, inventoryItem, normalizeInventory } from './replayEconomy.mjs';
import { buildWeaponAppearance, validWeaponEvidence } from './weaponAppearance.mjs';
import { mustContestRound } from './replayRoundContext.mjs';

const requireValue = (value, message) => { if (!value) throw new Error(`Banco inválido: ${message}`); };
const coverageError = message => Object.assign(new Error(message), { code: 'ROUND_BANK_COVERAGE' });

export function validateBankCatalog(catalog) {
  requireValue(catalog?.schema_version === 1 && Array.isArray(catalog.rounds), 'esquema o catálogo');
  const ids = new Set();
  const rounds = catalog.rounds.filter(r => r.eligible === true && r.map === 'de_mirage');
  for (const r of rounds) {
    requireValue(typeof r.round_id === 'string' && !ids.has(r.round_id), 'ID de ronda duplicado o ausente');
    ids.add(r.round_id);
    requireValue(typeof r.demo_id === 'string' && r.tail_complete === true &&
      Array.isArray(r.exclusions) && !r.exclusions.length, 'procedencia o elegibilidad');
    requireValue(['T', 'CT'].includes(r.winner_side) && ['ELIMINATION', 'DEFUSE', 'BOMB_EXPLOSION', 'TIME'].includes(r.win_condition), 'resultado');
    requireValue(/^\/(round-bank\/demos\/[a-f0-9]{64}\/r\d+\.json\.gz|round-bank-lab\/r\d+\.json)$/.test(r.replay_data_ref), 'referencia de replay');
    requireValue(Array.isArray(r.actors) && r.actors.length === 10 && new Set(r.actors.map(a => a.actor_id)).size === 10, 'diez actores únicos');
    for (const side of ['T', 'CT']) {
      requireValue(r.actors.filter(a => a.side === side).length === 5 &&
        ['PISTOL', 'ECO', 'FORCE', 'FULL'].includes(r.economy?.[side]) &&
        Number.isInteger(r.composition?.[side]?.awp) && r.composition[side].awp >= 0 && r.composition[side].awp <= 2, 'bando, composición o compra');
    }
    for (const actor of r.actors) {
      requireValue(typeof actor.actor_id === 'string' && /^\d+$/.test(actor.actor_id) && typeof actor.survived === 'boolean' &&
        ['kills', 'deaths', 'assists', 'flash_assists'].every(key => Number.isInteger(actor[key]) && actor[key] >= 0 && actor[key] <= 5) &&
        actor.deaths === Number(!actor.survived) && actor.flash_assists <= actor.assists, 'estadísticas de actor');
    }
  }
  requireValue(rounds.length > 0, 'no hay rondas elegibles de Mirage');
  return rounds;
}

function assignPlayers(metadata, team, side, key, stats, prepared, appearance = {}) {
  const actors = metadata.actors.filter(a => a.side === side).toSorted((a, b) => b.kills - a.kills);
  const players = team.players.map((p, i) => {
    const uid = `${key}:${p.uid ?? String(i)}`, record = stats.find(s => s.uid === uid);
    return { uid, name: p.name, deficit: record.targetKills - record.kills };
  });
  const permutations = [];
  const pairs = new Map(actors.map(actor => [actor.actor_id, new Map(players.map(player => [player.uid,
    buildWeaponAppearance(metadata, [{ actorId: actor.actor_id, playerUid: player.uid }], prepared, appearance)]))]));
  function visit(index, remaining, rows, score, map) {
    if (index === actors.length) { permutations.push({ assignments: rows, score, appearance: map }); return; }
    const actor = actors[index];
    for (const player of remaining) {
      const row = { actorId: actor.actor_id, playerUid: player.uid, name: player.name, team: key };
      const pair = pairs.get(actor.actor_id).get(player.uid);
      if (!pair) continue;
      const next = { ...map, ...pair };
      visit(index + 1, remaining.filter(p => p !== player), [...rows, row], score + player.deficit * actor.kills, next);
    }
  }
  visit(0, players, [], 0, appearance);
  return permutations.sort((a, b) => b.score - a.score);
}

export function compositionMatches(source, side, team) {
  const counts = inventories => inventories.reduce((result, inventory) => {
    const primary = inventory.map(inventoryItem).find(i => i?.kind === 'primary');
    const group = primary ? (['AWP', 'SSG08'].includes(primary.id) ? primary.id : 'primary') : 'none';
    result[group] = (result[group] ?? 0) + 1;
    return result;
  }, {});
  const original = counts(source.actors.filter(a => a.side === side).map(a => source.equipment.actors[a.actor_id].initialInventory));
  const purchased = counts(team.players.map(p => p.inventory));
  return ['AWP', 'SSG08', 'primary', 'none'].every(group => (original[group] ?? 0) === (purchased[group] ?? 0));
}

export function roundFitsSaveContext(source, proposal) {
  const losingTeam = source.winner_side === proposal.teamASide ? 'B' : 'A';
  // shortcut: losing survivors proxy saves; use replay intent evidence if this excludes too many genuine attempts.
  return !mustContestRound(proposal, losingTeam) || !source.actors.some(a => a.side !== source.winner_side && a.survived);
}

export function assembleMirageBO1(catalog, teamA, teamB, seed = 'mirage-bo1', assemblySeed = seed) {
  const initialDirector = createMacroDirector(teamA, teamB, seed), bank = validateBankCatalog(catalog);
  requireValue(catalog.equipment_version === 2 && bank.every(r => r.equipment && typeof r.equipment.supported === 'boolean'), 'falta catalogo economico con trazas de armas');
  const supported = bank.filter(r => r.equipment.supported);
  requireValue(supported.length, 'no hay rondas con equipamiento compatible');
  for (const r of supported) {
    const e = r.equipment, ids = new Set(r.actors.map(a => a.actor_id));
    requireValue(e.weaponEvidence?.actors?.length === 10 && new Set(e.weaponEvidence.actors).size === 10 &&
      e.weaponEvidence.actors.every(id => ids.has(id)) && validWeaponEvidence(e.weaponEvidence, e.weaponEvidence.actors, e.weaponEvidence.endTick), 'trazas de armas invalidas');
    requireValue(e.actors && Object.keys(e.actors).length === 10 && r.actors.every(a => {
      const item = e.actors[a.actor_id];
      return item && ['initialInventory', 'finalInventory'].every(k => normalizeInventory(item[k]) !== null) &&
        typeof item.initialHasKit === 'boolean' && typeof item.finalHasKit === 'boolean';
    }) && e.killRewards && Object.entries(e.killRewards).every(([id, n]) => ids.has(id) && Number.isFinite(n) && n >= 0) &&
      Array.isArray(e.planters) && e.planters.every(id => ids.has(id)) && Number.isInteger(e.ctKills) && e.ctKills >= 0, 'equipamiento o premios');
    if (e.killRewardsByWeapon !== undefined) {
      requireValue(e.killRewardsByWeapon && typeof e.killRewardsByWeapon === 'object' && !Array.isArray(e.killRewardsByWeapon) &&
        Object.entries(e.killRewardsByWeapon).every(([id, counts]) => ids.has(id) && counts && typeof counts === 'object' && !Array.isArray(counts) &&
          Object.entries(counts).every(([weapon, count]) => (inventoryItem(weapon) || /^(knife|bayonet)/.test(weapon)) && Number.isInteger(count) && count >= 0 && count <= 5)) &&
        r.actors.every(actor => Object.values(e.killRewardsByWeapon[actor.actor_id] ?? {}).reduce((sum, n) => sum + n, 0) === actor.kills), 'bajas por arma');
    }
  }
  const longRoundSides = new Set(supported.filter(r => r.economy.T !== 'PISTOL' && r.economy.CT !== 'PISTOL').map(r => r.winner_side));
  const pistolSides = new Set(supported.filter(r => r.economy.T === 'PISTOL' && r.economy.CT === 'PISTOL').map(r => r.winner_side));
  if (longRoundSides.size === 1 && pistolSides.size === 1) throw new Error('Sin cobertura: los mismos bandos ganan siempre y cada mitad termina empatada.');
  const demos = new Map((catalog.demos ?? []).map(d => [d.demo_id, d.demo.replace(/-p\d+(?=\.dem$)/, '')]));
  const provenance = r => demos.get(r.demo_id) ?? r.demo_id;
  const initialStats = initialDirector.plan.killTargets.map(target => ({ uid: target.playerUid, name: target.name,
    team: target.team === 'A' ? teamA.name : teamB.name, targetKills: target.targetKills, kills: 0, deaths: 0, assists: 0, flashAssists: 0 }));
  let attempts = 0, backtracks = 0;
  // shortcut: busqueda limitada a 1000 intentos; indexar estados si el banco requiere mas exploracion.
  const limit = 1000;
  const failed = new Set();
  function search(rounds, state, stats, sources) {
    let director = createMacroDirector(teamA, teamB, seed);
    for (const round of rounds) director.next(round.winner_side);
    if (director.done) return { rounds, state, stats, director };
    const proposal = { ...director.peek(), scoreTeam1: director.scoreTeam1, scoreTeam2: director.scoreTeam2 }, before = beginReplayRound(state, director.peek());
    const stateKey = JSON.stringify([director.scoreTeam1, director.scoreTeam2, before]);
    if (failed.has(stateKey)) return null;
    if (proposal.overtime && longRoundSides.size < 2) return null;
    const otherSide = proposal.teamASide === 'T' ? 'CT' : 'T';
    const random = seedrandom(`${assemblySeed}:assembly:${rounds.map(r => r.round_id).join(',')}`);
    const candidates = supported.filter(r => proposal.allowedWinnerSides.includes(r.winner_side) && roundFitsSaveContext(r, proposal) &&
      (proposal.pistol ? r.economy.T === 'PISTOL' && r.economy.CT === 'PISTOL' : r.economy.T !== 'PISTOL' && r.economy.CT !== 'PISTOL'))
      .map(r => ({ r, tie: random(), used: rounds.some(x => x.round_id === r.round_id), source: sources.get(provenance(r)) ?? 0 }))
      .sort((a, b) => Number(a.r.winner_side !== proposal.winnerSide) - Number(b.r.winner_side !== proposal.winnerSide) || a.used - b.used || a.source - b.source || a.tie - b.tie);
    // shortcut: eight seeded purchase variations; expand only if measured bank coverage requires it.
    function* options() {
      for (let buy = 0; buy < 8; buy++) {
        const purchase = prepareReplayBuys(before, teamA, teamB, proposal, seedrandom(`${assemblySeed}:buy:${stateKey}:${buy}`));
        const prepared = purchase.state;
        for (const { r: source } of candidates) {
          if (!compositionMatches(source, proposal.teamASide, prepared.A) || !compositionMatches(source, otherSide, prepared.B)) continue;
          const choicesA = assignPlayers(source, teamA, proposal.teamASide, 'A', stats, prepared);
          const choicesB = assignPlayers(source, teamB, otherSide, 'B', stats, prepared);
          if (!choicesA.length || !choicesB.length) continue;
          function* choices() {
            for (const a of choicesA) for (const b of choicesB) {
              yield { assignments: [...a.assignments, ...b.assignments], appearance: { ...a.appearance, ...b.appearance } };
            }
          }
          yield { source, purchase, choices };
        }
      }
    }
    // Try each source's best assignment before revisiting alternative assignments.
    const visited = new Set();
    for (const alternatives of [false, true]) for (const { source, purchase, choices } of options()) {
      const prepared = purchase.state;
      let index = 0;
      for (const { assignments, appearance } of choices()) {
        if (alternatives ? index++ === 0 : index++ > 0) { if (!alternatives) break; continue; }
        const after = finishReplayRound(prepared, source, assignments, { ...proposal, winnerSide: source.winner_side }, appearance);
        const nextKey = JSON.stringify([source.winner_side, after]);
        if (visited.has(nextKey)) continue;
        visited.add(nextKey);
        if (++attempts > limit) throw coverageError(`Busqueda economica agoto el limite de ${limit} candidatos`);
        const nextStats = structuredClone(stats);
        for (const assignment of assignments) {
          const actor = source.actors.find(x => x.actor_id === assignment.actorId), player = nextStats.find(x => x.uid === assignment.playerUid);
          player.kills += actor.kills; player.deaths += actor.deaths; player.assists += actor.assists; player.flashAssists += actor.flash_assists;
        }
        const plan = director.next(source.winner_side);
        const round = { ...source, round: plan.round, source_round: source.round, assignments,
          names: Object.fromEntries(assignments.map(x => [x.actorId, x.name])), weaponAppearance: appearance,
          economyAudit: { before, afterPreparation: prepared, after, actions: purchase.actions, strategies: purchase.strategies,
            reset: plan.round === 1 || plan.round === 13 || (plan.round >= 25 && (plan.round - 25) % 3 === 0) },
          macro: { ...plan, scoreTeam1: director.scoreTeam1, scoreTeam2: director.scoreTeam2,
            teamT: plan.teamASide === 'T' ? teamA.name : teamB.name, teamCT: plan.teamASide === 'CT' ? teamA.name : teamB.name } };
        const nextSources = new Map(sources); nextSources.set(provenance(source), (nextSources.get(provenance(source)) ?? 0) + 1);
        const result = search([...rounds, round], after, nextStats, nextSources);
        if (result) return result;
        backtracks++;
        director = createMacroDirector(teamA, teamB, seed);
        for (const previous of rounds) director.next(previous.winner_side);
      }
    }
    failed.add(stateKey);
    return null;
  }
  const result = search([], createReplayEconomy(teamA, teamB), initialStats, new Map());
  if (!result) throw coverageError('Sin cobertura económica para completar el partido');
  const { rounds, state, stats, director } = result;
  for (const player of stats) player.killDeviation = player.kills - player.targetKills;
  return { map: 'de_mirage', seed, macroPlan: director.plan, scoreTeam1: director.scoreTeam1, scoreTeam2: director.scoreTeam2,
    winner: director.scoreTeam1 > director.scoreTeam2 ? 'A' : 'B', playerStats: stats, economyFinal: state, economySearch: { attempts, backtracks },
    catalog: { schema_version: 1, source: { demo: `${teamA.name} vs ${teamB.name} · BO1 Mirage` }, names: {}, rounds } };
}
