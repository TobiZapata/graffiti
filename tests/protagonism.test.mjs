import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { createMacroDirector, matchWinProbability } from '../src/lib/macroDirector.mjs';
import { assembleMirageBO1, rankReplayAssignments } from '../src/lib/assembleMirageBO1.mjs';

const team = (name, strength = 80) => ({ id: name, name, mainAwperUid: '4', iglUid: '0',
  players: Array.from({ length: 5 }, (_, i) => ({ uid: String(i), name: name + i,
    awp: strength, rifler: strength, igl: 70, firepower: 80, clutch: 50 })) });

function assignmentFixture(kills = [3, 1, 1, 0, 0]) {
  const a = team('A'), b = team('B');
  const source = { round_id: 'test-round', actors: kills.map((kills, i) => ({ actor_id: String(i), side: 'T', kills })),
    equipment: { actors: Object.fromEntries(kills.map((_, i) => [String(i), { initialInventory: ['AK-47'] }])) } };
  const stats = a.players.map(p => ({ uid: `A:${p.uid}`, kills: 0 }));
  const prepared = { A: { players: stats.map(p => ({ uid: p.uid, inventory: ['AK-47'] })) }, B: { players: [] } };
  return { a, b, source, stats, prepared };
}

test('v3 probability grows with the strength gap, caps at70-30 and preserves old probabilities', () => {
  for (const [difference, expected] of [[0, 0.5], [5, 0.5353553390593274], [10, 0.6], [15, 0.6837117307087384], [20, 0.7]]) {
    const a = team('A', 75 + difference), b = team('B', 75);
    assert.ok(Math.abs(matchWinProbability(a, b) - expected) < 1e-12);
    assert.ok(Math.abs(matchWinProbability(a, b) + matchWinProbability(b, a) - 1) < 1e-12);
  }
  const a = team('A', 95), b = team('B', 85);
  assert.equal(matchWinProbability(a, b), 0.6);
  assert.equal(matchWinProbability(a, b, 2), 95 / 180);
  assert.equal(createMacroDirector(a, b, 'probability', 2).plan.winProbabilityA, 95 / 180);
  for (let strength = 0; strength <= 100; strength++) {
    const probability = matchWinProbability(team('A', strength), b);
    assert.ok(probability >= 0.3 && probability <= 0.7);
  }
});

test('v3 map form is seeded, positive and immutable, without kill or ranking targets', () => {
  const a = team('A'), b = team('B');
  a.players[0].firepower = 95; a.players[1].firepower = 65;
  let high = 0, low = 0, inversions = 0;
  for (let seed = 0; seed < 500; seed++) {
    const plan = createMacroDirector(a, b, seed).plan;
    assert.deepEqual(plan, createMacroDirector(a, b, seed).plan);
    assert.ok(!Object.hasOwn(plan, 'killTargets'));
    assert.ok(!Object.hasOwn(plan, 'rankTargets'));
    assert.equal(plan.playerTendencies.length, 10);
    assert.ok(plan.playerTendencies.every(p => Number.isFinite(p.protagonism) && p.protagonism > 0));
    high += plan.playerTendencies[0].protagonism; low += plan.playerTendencies[1].protagonism;
    inversions += plan.playerTendencies[1].protagonism > plan.playerTendencies[0].protagonism;
    assert.throws(() => { plan.playerTendencies[0].protagonism = 0; });
  }
  assert.ok(high > low * 1.4);
  assert.ok(inversions > 0);
  a.players.forEach(p => { p.firepower = 0; });
  assert.ok(createMacroDirector(a, b, 'zero').plan.playerTendencies.every(p => p.protagonism > 0));
  assert.throws(() => createMacroDirector(a, b, 'version', 999));
});

test('engine2 retains the previous v2-player macro plans and full round sequences', () => {
  const make = name => ({ id: name, name, mainAwperUid: '4', iglUid: '0', players: Array.from({ length: 5 }, (_, i) => ({
    uid: String(i), name: name + i, awp: 80 + i, rifler: 85 - i * 3, igl: 90 - i * 12, firepower: 95 - i * 8, clutch: 90 - i * 10,
  })) });
  const a = make('A'), b = make('B'); b.players[0].igl = 70;
  const digest = createHash('sha256');
  for (let seed = 0; seed < 100; seed++) {
    const director = createMacroDirector(a, b, seed, 2), rounds = [];
    while (!director.done && rounds.length < 1000) rounds.push(director.next());
    assert.ok(director.done);
    digest.update(JSON.stringify({ plan: director.plan, rounds }) + '\n');
  }
  // Captured before removing quotas, to protect already-started v2 Majors.
  assert.equal(digest.digest('hex'), '325b40d847e70fece2aac1b3e6416c07c3b3b05aacd834d941f1126d40604453');
});

test('v3 assignments reward firepower on average with round variation and no accumulated-kill brake', () => {
  const { a, b, source, stats, prepared } = assignmentFixture();
  a.players[0].firepower = 95; a.players[1].firepower = 65;
  const totals = Array(5).fill(0);
  let inversions = 0, roundChanges = 0;
  for (let seed = 0; seed < 200; seed++) {
    const playerTendencies = createMacroDirector(a, b, seed).plan.playerTendencies;
    const options = { engineVersion: 3, playerTendencies }, mapKills = Array(5).fill(0);
    let first;
    for (let round = 0; round < 10; round++) {
      const picked = rankReplayAssignments(source, a, 'T', 'A', stats, prepared, {}, `${seed}:${round}`, options)[0];
      const hero = picked.assignments.find(p => p.actorId === '0').playerUid;
      first ??= hero; roundChanges += hero !== first;
      for (const assignment of picked.assignments) mapKills[Number(assignment.playerUid.split(':')[1])] += source.actors.find(actor => actor.actor_id === assignment.actorId).kills;
      if (seed === 0 && round === 0) {
        const inflated = stats.map(p => ({ ...p, kills: p.uid === 'A:0' ? 1000 : 0, targetKills: -100 }));
        assert.deepEqual(picked, rankReplayAssignments(source, a, 'T', 'A', inflated, prepared, {}, `${seed}:${round}`, options)[0]);
      }
    }
    mapKills.forEach((kills, i) => { totals[i] += kills; });
    inversions += mapKills[1] > mapKills[0];
  }
  assert.ok(totals[0] > totals[1] * 1.15, `Unexpected kills: ${totals}`);
  assert.ok(inversions > 0);
  assert.ok(roundChanges > 0);
  prepared.A.players[0].inventory = ['AWP'];
  const options = { engineVersion: 3, playerTendencies: createMacroDirector(a, b, 'equipment').plan.playerTendencies };
  assert.equal(rankReplayAssignments(source, a, 'T', 'A', stats, prepared, {}, 'equipment', options).length, 0);
});

test('v3 clutch preference remains soft and respects source survival confidence', () => {
  const { a, b, source, stats, prepared } = assignmentFixture([1, 1, 1, 1, 1]);
  a.players[0].clutch = 95;
  source.clutch = { actor_id: '0', survived_at_resolution: true };
  const counts = Array(5).fill(0);
  const options = { engineVersion: 3, playerTendencies: createMacroDirector(a, b, 'clutch').plan.playerTendencies.map(p => ({ ...p, protagonism: 1 })) };
  for (let seed = 0; seed < 250; seed++) {
    const picked = rankReplayAssignments(source, a, 'T', 'A', stats, prepared, {}, seed, options)[0];
    counts[Number(picked.assignments.find(p => p.actorId === '0').playerUid.split(':')[1])]++;
  }
  assert.ok(counts[0] > Math.max(...counts.slice(1)));
  assert.ok(counts[0] < 250);
  source.clutch.survived_at_resolution = false;
  let uncertain = 0;
  for (let seed = 0; seed < 250; seed++) {
    const picked = rankReplayAssignments(source, a, 'T', 'A', stats, prepared, {}, seed, options)[0];
    uncertain += picked.assignments.find(p => p.actorId === '0').playerUid === 'A:0';
  }
  assert.ok(counts[0] > uncertain, 'survival evidence strengthens the soft clutch preference');
});

test('v3 real-bank maps preserve winner, evidence, stats and deterministic reloading without quotas', () => {
  const catalog = JSON.parse(readFileSync(new URL('../public/round-bank/economy-index.json', import.meta.url)));
  const a = team('A'), b = team('B'); a.players[0].firepower = 95; a.players[1].firepower = 65;
  for (const seed of ['protagonism-a', 'protagonism-b', 'protagonism-c']) {
    const match = assembleMirageBO1(catalog, a, b, seed);
    assert.deepEqual(match, assembleMirageBO1(catalog, a, b, seed));
    assert.equal(match.winner, match.macroPlan.winnerTeam);
    assert.ok(!Object.hasOwn(match.macroPlan, 'killTargets'));
    for (const player of match.playerStats) {
      assert.ok(!Object.hasOwn(player, 'targetKills') && !Object.hasOwn(player, 'killDeviation'));
      const actors = match.catalog.rounds.map(round => round.actors.find(actor => actor.actor_id === round.assignments.find(p => p.playerUid === player.uid).actorId));
      assert.equal(player.kills, actors.reduce((sum, actor) => sum + actor.kills, 0));
    }
    for (const round of match.catalog.rounds) assert.deepEqual(round.actors, catalog.rounds.find(source => source.round_id === round.round_id).actors);
  }
});
