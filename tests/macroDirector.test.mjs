import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMacroDirector as createVersionedDirector, validateTeams } from '../src/lib/macroDirector.mjs';

const createMacroDirector = (a, b, seed) => createVersionedDirector(a, b, seed, 2);

const team = name => ({ id: name, name, players: Array.from({ length: 5 }, (_, i) => ({ name: `${name}${i}`, rating: 80 })) });
const v2Team = name => ({ id: name, name, mainAwperUid: '0', iglUid: '0', players: Array.from({ length: 5 }, (_, i) => ({ name: `${name}${i}`, awp: 80, rifler: 80, igl: 70, firepower: 80, clutch: 70 })) });
const play = (a, b, seed) => {
  const director = createMacroDirector(a, b, seed), rounds = [];
  while (!director.done && rounds.length < 1000) rounds.push(director.next());
  assert.ok(director.done, `match did not finish within 1000 rounds: ${seed}`);
  return { rounds, score: [director.scoreTeam1, director.scoreTeam2], director };
};

test('match-ending preview follows the actual winner in regulation and overtime without advancing play', () => {
  for (const overtime of [false, true]) {
    const director = createMacroDirector(team('A'), team('B'), 'finish-preview');
    const winner = director.plan.winnerTeam, loser = winner === 'A' ? 'B' : 'A';
    const sideFor = key => key === 'A' ? director.peek().teamASide : director.peek().teamASide === 'T' ? 'CT' : 'T';
    const win = key => director.next(sideFor(key));
    for (let i = 0; i < 12; i++) win(winner);
    for (let i = 0; i < (overtime ? 12 : 7); i++) win(loser);
    if (overtime) for (let i = 0; i < 3; i++) win(winner);
    const pending = director.peek(), scores = [director.scoreTeam1, director.scoreTeam2];
    assert.equal(director.wouldFinish(sideFor(winner)), true);
    assert.equal(director.wouldFinish(sideFor(loser)), false);
    assert.equal(director.peek(), pending);
    assert.deepEqual([director.scoreTeam1, director.scoreTeam2], scores);
    win(loser);
    assert.equal(director.done, false, 'losing a match point keeps normal playback');
    assert.equal(director.wouldFinish(sideFor(winner)), true);
    win(winner);
    assert.equal(director.done, true);
    assert.equal(director.scoreTeam1 + director.scoreTeam2, overtime ? 29 : 21);
  }
});

test('validates teams, unique players and numeric stats without coercion', () => {
  const a = team('A'), b = team('B');
  validateTeams(a, b);
  for (const mutate of [
    x => { x.name = ' '; }, x => { x.players.pop(); },
    x => { x.players[1].name = x.players[0].name; },
    x => { x.players[0].uid = x.players[1].uid = 'same'; },
    x => { x.players[0].aim = '80'; }, x => { x.players[0].rating = NaN; },
    x => { x.players[0].composure = 101; },
  ]) {
    const invalid = structuredClone(a); mutate(invalid);
    assert.throws(() => validateTeams(invalid, b));
  }
  assert.throws(() => validateTeams(a, { ...b, id: a.id }));
});

test('rejects nondeterministic or invalid seeds', () => {
  for (const seed of [null, {}, NaN, Infinity, '', '  ']) {
    assert.throws(() => createMacroDirector(team('A'), team('B'), seed), /semilla/);
  }
});

test('regulation can end 13-0 without playing further rounds', () => {
  const a = team('A'), b = team('B');
  a.players.forEach(p => { p.rating = 100; });
  b.players.forEach(p => { p.rating = 1; });
  const result = play(a, b, '13-0');
  assert.deepEqual(result.score, [13, 0]);
  assert.equal(result.rounds.length, 13);
  assert.equal(result.rounds[12].teamASide, 'CT');
  assert.throws(() => result.director.next());
});

test('deterministic seeds preserve inputs and global randomness', () => {
  const a = team('A'), b = team('B'), before = structuredClone([a, b]), originalRandom = Math.random;
  for (const seed of [0, 'test']) {
    const one = play(a, b, seed), two = play(a, b, seed);
    assert.deepEqual(one.rounds, two.rounds);
    assert.deepEqual(one.score, two.score);
    assert.throws(() => one.director.next());
  }
  assert.deepEqual([a, b], before);
  assert.equal(Math.random, originalRandom);
});

test('regulation and multiple overtime periods have correct sides and finish thresholds', () => {
  const a = team('A'), b = team('B');
  let result;
  for (let seed = 0; seed < 10000; seed++) {
    const candidate = play(a, b, seed);
    if (candidate.rounds.at(-1).overtime >= 2) { result = candidate; break; }
  }
  assert.ok(result, 'found a match with multiple overtimes');
  for (const r of result.rounds) {
    assert.equal(r.pistol, r.round === 1 || r.round === 13);
    assert.equal(r.teamASide, r.half === 1 ? 'T' : 'CT');
    assert.equal(r.winnerSide, r.winnerTeam === 'A' ? r.teamASide : r.teamASide === 'T' ? 'CT' : 'T');
    if (r.round <= 24) assert.equal(r.half, r.round <= 12 ? 1 : 2);
    else {
      assert.equal(r.overtime, Math.floor((r.round - 25) / 6) + 1);
      assert.equal(r.half, Math.floor((r.round - 25) % 6 / 3) + 1);
    }
  }
  assert.equal(Math.max(...result.score), 13 + result.rounds.at(-1).overtime * 3);
  assert.ok(Math.abs(result.score[0] - result.score[1]) >= 2);
});

test('macro plan is immutable, deterministic and fixes the winner before play', () => {
  const a = team('A'), b = team('B'), before = structuredClone([a, b]), originalRandom = Math.random;
  let overtimeTargets = 0;
  for (let seed = 0; seed < 300; seed++) {
    const d = createMacroDirector(a, b, seed), copy = createMacroDirector(a, b, seed);
    assert.deepEqual(d.plan, copy.plan);
    if (Math.max(d.plan.targetScore.A, d.plan.targetScore.B) > 13) overtimeTargets++;
    assert.equal(d.plan.killTargets.length, 10);
    assert.equal(new Set(d.plan.killTargets.map(p => p.playerUid)).size, 10);
    assert.ok(d.plan.killTargets.every(p => Number.isInteger(p.targetKills) && p.targetKills >= 0));
    assert.throws(() => { d.plan.winnerTeam = 'changed'; });
    assert.throws(() => { d.plan.targetScore.A = 0; });
    assert.throws(() => { d.plan.killTargets[0].targetKills = 0; });
    for (let rounds = 0; !d.done && rounds < 1000; rounds++) d.next();
    assert.ok(d.done, `match did not finish within 1000 rounds: ${seed}`);
    assert.equal(d.scoreTeam1 > d.scoreTeam2 ? 'A' : 'B', d.plan.winnerTeam);
    assert.deepEqual({ A: d.scoreTeam1, B: d.scoreTeam2 }, d.plan.targetScore);
  }
  assert.ok(overtimeTargets > 0);
  assert.deepEqual([a, b], before);
  assert.equal(Math.random, originalRandom);
});

test('IGL skill and signed compatibility affect initial probability only', () => {
  const a = team('A'), b = team('B');
  a.iglUid = '0'; a.players[0].gamesense = 90;
  const probability = compatibility => { a.iglCompatibility = compatibility; return createMacroDirector(a, b, 5).plan.winProbabilityA; };
  assert.ok(probability(-1) < probability(0));
  assert.ok(probability(0) < probability(1));
  a.iglCompatibility = 0;
  const high = probability(0);
  a.players[0].gamesense = 60;
  assert.ok(probability(0) < high);
  for (const mutate of [
    t => { t.iglUid = 'missing'; }, t => { t.mainAwperUid = 1; },
    t => { t.iglCompatibility = 1.1; }, t => { t.players[0].gamesense = NaN; },
    t => { t.players[1].uid = '0'; },
  ]) { const invalid = structuredClone(a); mutate(invalid); assert.throws(() => validateTeams(invalid, b)); }
  a.iglUid = undefined; a.players[0].role = 'IGL';
  assert.notEqual(createMacroDirector(a, b, 5).plan.winProbabilityA, 0.5);
});

test('observed rounds may deviate into multiple overtimes but cannot let the other team win', () => {
  const d = createMacroDirector(team('A'), team('B'), 'deviation');
  const winner = d.plan.winnerTeam, loser = winner === 'A' ? 'B' : 'A';
  const award = wanted => {
    const c = d.peek();
    assert.strictEqual(d.peek(), c);
    const side = wanted === 'A' ? c.teamASide : c.teamASide === 'T' ? 'CT' : 'T';
    assert.ok(c.allowedWinnerSides.includes(side));
    assert.equal(d.next(side).winnerTeam, wanted);
  };
  for (let i = 0; i < 12; i++) { award('A'); award('B'); }
  for (let period = 0; period < 2; period++) {
    award(loser); award(winner); award(loser); award(winner); award(loser);
    const c = d.peek(), forbidden = loser === 'A' ? c.teamASide : c.teamASide === 'T' ? 'CT' : 'T';
    const score = [d.scoreTeam1, d.scoreTeam2];
    assert.throws(() => d.next(forbidden));
    assert.throws(() => d.next('invalid'));
    assert.deepEqual([d.scoreTeam1, d.scoreTeam2], score);
    assert.strictEqual(d.peek(), c);
    award(winner);
  }
  assert.equal(d.peek().overtime, 3);
  for (let rounds = 0; !d.done && rounds < 1000; rounds++) d.next();
  assert.ok(d.done);
  assert.equal(d.scoreTeam1 > d.scoreTeam2 ? 'A' : 'B', winner);
  assert.notDeepEqual({ A: d.scoreTeam1, B: d.scoreTeam2 }, d.plan.targetScore);
});

test('extreme valid IGL inputs keep probabilities bounded', () => {
  const a = team('A'), b = team('B');
  for (const t of [a, b]) {
    t.iglUid = '0'; t.iglCompatibility = -1;
    t.players.forEach(p => { p.rating = 1; p.gamesense = 1; });
  }
  for (const [rating, compatibility] of [[1, -1], [100, 1]]) {
    a.players.forEach(p => { p.rating = rating; p.gamesense = rating; });
    a.iglCompatibility = compatibility;
    const probability = createMacroDirector(a, b, 0).plan.winProbabilityA;
    assert.ok(Number.isFinite(probability) && probability >= 0 && probability <= 1);
    const reversed = createMacroDirector(b, a, 0).plan.winProbabilityA;
    assert.ok(Number.isFinite(reversed) && reversed >= 0 && reversed <= 1);
  }
});

test('deviating rounds preserve either macro winner across seeds', () => {
  const winners = new Set();
  for (let seed = 0; seed < 300; seed++) {
    const d = createMacroDirector(team('A'), team('B'), seed);
    winners.add(d.plan.winnerTeam);
    for (let rounds = 0; !d.done && rounds < 1000; rounds++) {
      const c = d.peek();
      const observed = c.allowedWinnerSides.find(side => side !== c.winnerSide) ?? c.winnerSide;
      d.next(observed);
    }
    assert.ok(d.done, `match did not finish within 1000 rounds: ${seed}`);
    assert.equal(d.scoreTeam1 > d.scoreTeam2 ? 'A' : 'B', d.plan.winnerTeam);
  }
  assert.deepEqual(winners, new Set(['A', 'B']));
});

test('IGL changes only the initial winner probability when the winner is unchanged', () => {
  const a = team('A'), b = team('B');
  a.iglUid = '0'; a.players[0].gamesense = 20; a.iglCompatibility = -1;
  const changed = structuredClone(a);
  changed.players[0].gamesense = 100; changed.iglCompatibility = 1;
  let checked = 0;
  for (let seed = 0; seed < 100; seed++) {
    const low = createMacroDirector(a, b, seed), high = createMacroDirector(changed, b, seed);
    assert.notEqual(low.plan.winProbabilityA, high.plan.winProbabilityA);
    if (low.plan.winnerTeam !== high.plan.winnerTeam) continue;
    checked++;
    assert.deepEqual(low.plan.targetScore, high.plan.targetScore);
    assert.deepEqual(low.plan.killTargets, high.plan.killTargets);
    for (let rounds = 0; !low.done && rounds < 1000; rounds++) assert.deepEqual(low.next(), high.next());
    assert.ok(low.done && high.done);
  }
  assert.ok(checked > 0);
});

test('equal teams do not produce an artificially high overtime rate', () => {
  let overtime = 0;
  for (let seed = 0; seed < 1000; seed++) {
    const score = createMacroDirector(team('A'), team('B'), seed).plan.targetScore;
    if (Math.max(score.A, score.B) > 13) overtime++;
  }
  assert.ok(overtime >= 50 && overtime <= 350, `unexpected overtime count: ${overtime}`);
});

test('v2 scores require complete integer attributes, including valid zero values', () => {
  const a = v2Team('A'), b = v2Team('B');
  for (const stat of ['awp', 'rifler', 'igl', 'firepower', 'clutch']) {
    for (const bad of [undefined, null, NaN, '80', -1, 101, 50.5]) {
      const invalid = structuredClone(a); invalid.players[0][stat] = bad;
      assert.throws(() => validateTeams(invalid, b));
    }
  }
  a.players.forEach(p => { for (const stat of ['awp', 'rifler', 'igl', 'firepower', 'clutch']) p[stat] = 0; });
  b.players = a.players.map((p, i) => ({ ...p, name: `B${i}` }));
  const plan = createMacroDirector(a, b, 'zeros').plan;
  assert.equal(plan.winProbabilityA, 0.5);
  assert.ok(plan.killTargets.every(p => Number.isFinite(p.targetKills)));
});

test('v2 uses assigned combat role and leadership, while firepower only distributes kills', () => {
  const a = v2Team('A'), b = v2Team('B');
  const probability = () => createMacroDirector(a, b, 'roles').plan.winProbabilityA;
  assert.equal(probability(), 0.5);
  a.players[1].awp = 100; a.players[0].rifler = 100;
  assert.equal(probability(), 0.5, 'unused role scores do not add power');
  a.players[0].awp = 100;
  assert.ok(probability() > 0.5);
  const before = probability(); a.players[0].igl = 100;
  assert.ok(probability() > before, 'AWPer can also lead without becoming a sixth player');
  const macro = createMacroDirector(a, b, 'roles').plan;
  a.players[0].firepower = 0; a.players[0].clutch = 0; a.players[0].imageUrl = '/portrait.png';
  const changed = createMacroDirector(a, b, 'roles').plan;
  assert.equal(changed.winProbabilityA, macro.winProbabilityA);
  assert.equal(changed.winnerTeam, macro.winnerTeam);
  assert.deepEqual(changed.targetScore, macro.targetScore);
  assert.notDeepEqual(changed.killTargets, macro.killTargets);
});

test('v2 kill targets favor firepower over many seeds but allow lower scorers to lead', () => {
  const a = v2Team('A'), b = v2Team('B');
  a.players[0].firepower = 95; a.players[1].firepower = 70;
  let high = 0, low = 0, inversions = 0;
  for (let seed = 0; seed < 500; seed++) {
    const plan = createMacroDirector(a, b, seed).plan;
    const targets = plan.killTargets.filter(p => p.team === 'A');
    high += targets[0].targetKills; low += targets[1].targetKills;
    inversions += targets[1].targetKills > targets[0].targetKills;
    assert.ok(Math.abs(targets.reduce((sum, p) => sum + p.targetKills, 0) - (plan.targetScore.A + plan.targetScore.B) * 3.25) <= 2.5);
    assert.deepEqual(plan, createMacroDirector(a, b, seed).plan);
  }
  assert.ok(high > low * 1.2);
  assert.ok(inversions > 0, 'a weaker player can have a great map');
});

test('mixed saved drafts support legacy and v2 players without generating attributes', () => {
  const a = v2Team('A'), b = team('B');
  a.players[2] = { name: 'legacy-pick', rating: 72, clutch: 70 };
  const before = structuredClone([a, b]);
  const plan = createMacroDirector(a, b, 'mixed-draft').plan;
  assert.ok(plan.killTargets.every(p => Number.isFinite(p.targetKills)));
  assert.deepEqual([a, b], before);
  a.players.forEach(p => { p.imageUrl = '/portrait.png'; p.personId = p.name; });
  assert.deepEqual(createMacroDirector(a, b, 'mixed-draft').plan, plan);
});
