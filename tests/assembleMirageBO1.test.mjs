import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { assembleMirageBO1, validateBankCatalog, compositionMatches, roundFitsSaveContext } from '../src/lib/assembleMirageBO1.mjs';
import { inventoryItem } from '../src/lib/replayEconomy.mjs';
import { visibleWeapon, buildWeaponAppearance } from '../src/lib/weaponAppearance.mjs';

const samples = JSON.parse(readFileSync(new URL('../public/round-bank-lab/index.json', import.meta.url)));
const realCatalog = new URL('../public/round-bank/economy-index.json', import.meta.url);
const team = name => ({ id: name, name, mainAwperUid: '4', players: Array.from({ length: 5 }, (_, i) => ({
  name: `${name}${i}`, uid: `${i}`, rating: 80 + i, role: i === 0 ? 'AWPER' : 'RIFLER',
})) });
function fixture() {
  return { schema_version: 1, equipment_version: 2, rounds: Array.from({ length: 4 }, (_, i) => {
    const pistol = i < 2, winner_side = i % 2 ? 'CT' : 'T', source = samples.rounds[pistol ? 0 : 2];
    return { ...structuredClone(source), round_id: `fixture-${i}`, demo_id: `demo-${i}`,
      winner_side, win_condition: 'ELIMINATION', economy: { T: pistol ? 'PISTOL' : 'FULL', CT: pistol ? 'PISTOL' : 'FULL' },
      equipment: { supported: true, actors: Object.fromEntries(source.actors.map(a => {
        const initialInventory = pistol ? ['AWP'] : ['SSG 08'];
        return [a.actor_id, { initialInventory, finalInventory: a.survived ? initialInventory : [], initialHasKit: false, finalHasKit: false }];
      })), weaponEvidence: { actors: source.actors.map(a => a.actor_id), endTick: 1, changes: source.actors.map(a => [1, a.actor_id, [pistol ? 'AWP' : 'SSG08']]), deaths: [], pickups: [] }, killRewards: {}, planters: [], ctKills: 0 } };
  }) };
}

test('real matches preserve source evidence, purchased appearances and player stats', { skip: !existsSync(realCatalog) }, () => {
  const catalog = JSON.parse(readFileSync(realCatalog)), a = team('A'), b = team('B');
  const original = structuredClone([catalog, a, b]), originalRandom = Math.random;
  for (let seed = 0; seed < 5; seed++) {
    const match = assembleMirageBO1(catalog, a, b, seed);
    if (seed === 0) {
      assert.deepEqual(match, assembleMirageBO1(catalog, a, b, seed));
      const retry = assembleMirageBO1(catalog, a, b, seed, 'another-assembly-seed');
      assert.deepEqual(retry.macroPlan, match.macroPlan);
      assert.equal(retry.winner, match.winner);
    }
    assert.equal(match.winner, match.macroPlan.winnerTeam);
    assert.equal(match.catalog.rounds.length, match.scoreTeam1 + match.scoreTeam2);
    assert.deepEqual(match.economyFinal, match.catalog.rounds.at(-1).economyAudit.after);
    for (const [i, round] of match.catalog.rounds.entries()) {
      const previous = match.catalog.rounds[i - 1]?.macro;
      assert.ok(roundFitsSaveContext(round, { round: i + 1, teamASide: round.macro.teamASide,
        scoreTeam1: previous?.scoreTeam1 ?? 0, scoreTeam2: previous?.scoreTeam2 ?? 0 }));
      const source = catalog.rounds.find(r => r.round_id === round.round_id);
      assert.equal(round.round, i + 1);
      assert.deepEqual(round.actors, source.actors);
      assert.equal(round.replay_data_ref, source.replay_data_ref);
      assert.equal(new Set(round.assignments.map(x => x.playerUid)).size, 10);
      for (const assignment of round.assignments) {
        const actor = round.equipment.actors[assignment.actorId];
        const player = round.economyAudit.afterPreparation[assignment.team].players.find(p => p.uid === assignment.playerUid);
        for (const kind of ['primary', 'pistol']) {
          const observed = actor.initialInventory.find(item => inventoryItem(item)?.kind === kind);
          const purchased = player.inventory.find(item => inventoryItem(item)?.kind === kind);
          assert.equal(observed ? inventoryItem(visibleWeapon(observed, round.weaponAppearance[assignment.actorId])).id : null, purchased ? inventoryItem(purchased).id : null);
        }
      }
      for (const side of ['A', 'B']) for (const player of round.economyAudit.afterPreparation[side].players) {
        assert.ok(player.money >= 0);
        const before = round.economyAudit.before[side].players.find(p => p.uid === player.uid);
        for (const item of before.inventory.filter(item => inventoryItem(item)?.kind === 'primary')) {
          const action = round.economyAudit.actions[side].find(x => (x.type === 'transfer' && x.from === player.uid && x.item === item) || (x.type === 'buy' && x.to === player.uid && inventoryItem(x.item)?.kind === 'primary'));
          if (!action) assert.ok(player.inventory.includes(item));
        }
      }
    }
    for (const p of match.playerStats) {
      const actors = match.catalog.rounds.flatMap(r => r.assignments.filter(x => x.playerUid === p.uid).map(x => r.actors.find(actor => actor.actor_id === x.actorId)));
      for (const [stat, field] of [['kills', 'kills'], ['deaths', 'deaths'], ['assists', 'assists'], ['flashAssists', 'flash_assists']]) assert.equal(p[stat], actors.reduce((sum, actor) => sum + actor[field], 0));
      assert.equal(p.killDeviation, p.kills - p.targetKills);
    }
  }
  assert.deepEqual([catalog, a, b], original);
  assert.equal(Math.random, originalRandom);
});

test('save context excludes losing survivors only at side endings or elimination match points', () => {
  for (const teamASide of ['T', 'CT']) for (const winner_side of ['T', 'CT']) {
    const source = { winner_side, actors: [{side: winner_side, survived:true}, {side: winner_side === 'T' ? 'CT' : 'T', survived:true}] };
    const base = {round:10, teamASide, scoreTeam1:5, scoreTeam2:4};
    assert.equal(roundFitsSaveContext(source,base),true);
    for (const round of [12,24,27,30,33,36]) assert.equal(roundFitsSaveContext(source,{...base,round}),false);
    for (const [round, point] of [[20,12],[28,15],[34,18]]) {
      const winnerScore = winner_side === teamASide ? 'scoreTeam1' : 'scoreTeam2';
      const loserScore = winner_side === teamASide ? 'scoreTeam2' : 'scoreTeam1';
      assert.equal(roundFitsSaveContext(source,{...base,round,[winnerScore]:point}),false);
      assert.equal(roundFitsSaveContext(source,{...base,round,[loserScore]:point}),true);
      assert.equal(roundFitsSaveContext(source,{...base,round,scoreTeam1:point,scoreTeam2:point}),false);
      const eliminated = {...source,actors:source.actors.map(a=>({...a,survived:a.side===winner_side}))};
      assert.equal(roundFitsSaveContext(eliminated,{...base,round,[winnerScore]:point}),true);
    }
  }
});

test('uncovered equipment fails with a coverage error', () => {
  assert.throws(() => assembleMirageBO1(fixture(), team('A'), team('B'), 0), error => error.code === 'ROUND_BANK_COVERAGE');
});

test('mixed M4 appearances preserve exactly the same 154 structural CT sources', { skip: !existsSync(realCatalog) }, () => {
  const catalog = JSON.parse(readFileSync(realCatalog));
  const make = mixed => ({ players: Array.from({ length: 5 }, (_, i) => ({ uid: `CT:${i}`, inventory: [mixed && i < 3 ? 'M4A4' : 'M4A1-S', 'USP-S'] })) });
  let plain = 0, mixed = 0;
  for (const round of catalog.rounds.filter(r => r.equipment.supported)) {
    const actors = round.actors.filter(a => a.side === 'CT');
    const a = make(false), b = make(true);
    if (compositionMatches(round, 'CT', a)) plain++;
    if (compositionMatches(round, 'CT', b)) {
      mixed++;
      const assignments = actors.map((actor, i) => ({ actorId: actor.actor_id, playerUid: `CT:${i}` }));
      // Preserve the same observed sidearm presence while varying only the five primary models.
      actors.forEach((actor, i) => {
        if (!round.equipment.actors[actor.actor_id].initialInventory.some(item => inventoryItem(item)?.kind === 'pistol')) b.players[i].inventory.pop();
      });
      assert.ok(buildWeaponAppearance(round, assignments, { A: b, B: { players: [] } }));
    }
  }
  assert.equal(plain, 154);
  assert.equal(mixed, plain);
});

test('refuses missing enrichment, invalid identities and replay paths', () => {
  assert.throws(() => assembleMirageBO1(samples, team('A'), team('B'), 0), /economico/);
  const catalog = fixture();
  for (const mutate of [
    c => { c.rounds[0].actors[0].actor_id = 123; },
    c => { c.rounds[0].actors[0].kills = NaN; },
    c => { c.rounds[0].replay_data_ref = 'https://example.com/round.json'; },
    c => { c.rounds[0].tail_complete = false; },
    c => { c.rounds[0].composition.T.awp = 3; },
    c => { c.rounds.push(c.rounds[0]); },
  ]) { const broken = structuredClone(catalog); mutate(broken); assert.throws(() => validateBankCatalog(broken), /Banco inválido/); }
  const invalidRewards = fixture();
  invalidRewards.rounds[0].equipment.killRewardsByWeapon = { [invalidRewards.rounds[0].actors[0].actor_id]: { ak47: -1 } };
  assert.throws(() => assembleMirageBO1(invalidRewards, team('A'), team('B'), 0), /bajas por arma/);
  catalog.rounds.forEach(r => { r.eligible = false; });
  assert.throws(() => validateBankCatalog(catalog), /no hay rondas/);
});
