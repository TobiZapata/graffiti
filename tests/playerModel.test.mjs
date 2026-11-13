import test from 'node:test';
import assert from 'node:assert/strict';
import { isV2Player, validateV2Player } from '../src/lib/playerModel.mjs';
import { prepareReplayTeam } from '../src/lib/replayTeam.mjs';
import { expandPlayerStats, formatTeamForSimulation } from '../src/app/utils/playerExpansion.js';
import { selectReplayMap } from '../src/lib/replayMaps.mjs';
import { simulateNpcMatch } from '../src/lib/simulateNpcMatch.mjs';
import { readFileSync } from 'node:fs';
import { upgradeOrganization } from '../src/lib/upgradeOrganization.mjs';
import { CURRENT_SIMULATION } from '../src/lib/simulationVersion.mjs';
import { createMacroDirector } from '../src/lib/macroDirector.mjs';

const catalog = JSON.parse(readFileSync(new URL('../src/data/teams.json', import.meta.url)));

test('future-Major upgrades preserve slots, unknown entries and original active snapshots', () => {
  const original = { mainAwperUid: '0', iglUid: '0', squad: [
    { player: { id: 1, name: 'JW', aim: 80 }, team: { name: catalog[0].name, major: catalog[0].major } },
    { player: { id: 90, name: 'Uncalibrated', aim: 70 }, team: { name: 'Legacy', major: '2014' } },
  ] };
  const before = structuredClone(original);
  const updated = upgradeOrganization(original, catalog);
  assert.deepEqual(original, before);
  assert.deepEqual(updated.squad[0].player, catalog[0].players[0]);
  assert.equal(updated.squad[1], original.squad[1]);
  assert.equal(updated.mainAwperUid, '0');
  assert.equal(updated.iglUid, '0');
  assert.equal(upgradeOrganization(updated, catalog), updated);
});

test('approved catalog prepares all players without manufacturing legacy stats', () => {
  assert.equal(catalog.length, 32);
  const ids = new Set(), playerIds = new Set();
  for (const team of catalog) {
    assert.ok(!ids.has(team.id)); ids.add(team.id);
    const formatted = formatTeamForSimulation(team);
    assert.equal(formatted.mainAwperUid, team.mainAwperUid);
    assert.equal(formatted.iglUid, team.iglUid);
    const prepared = prepareReplayTeam(formatted);
    for (const player of prepared.players) {
      assert.ok(!playerIds.has(player.id)); playerIds.add(player.id);
      validateV2Player(player);
      assert.equal(player.aim, undefined);
      assert.deepEqual(expandPlayerStats(player), player);
    }
  }
  assert.equal(playerIds.size, 160);
});

test('partial, missing and invalid new scores fail instead of creating random players', () => {
  assert.equal(isV2Player({ clutch: 70, aim: 75 }), false);
  const base = catalog[0].players[0];
  for (const key of ['awp', 'rifler', 'igl', 'firepower', 'clutch']) {
    for (const value of [undefined, null, '80', -1, 101, 2.5, NaN]) {
      assert.throws(() => expandPlayerStats({ ...base, [key]: value }));
    }
  }
  validateV2Player({ awp: 0, rifler: 100, igl: 0, firepower: 0, clutch: 0 });
});

test('NPC results are deterministic, respect series formats and need no round bank', () => {
  const teamA = { ...formatTeamForSimulation(catalog[0]), id: 'A', wins: 0, losses: 0 };
  const teamB = { ...formatTeamForSimulation(catalog[1]), id: 'B', wins: 0, losses: 0 };
  for (const [round, maxMaps, wins] of [[1, 1, null], ['Quarterfinals', 3, 2], ['Final', 5, 3]]) {
    const match = { id: 'test', round, teamA, teamB };
    const result = simulateNpcMatch(match, 'seed');
    assert.deepEqual(result, simulateNpcMatch(match, 'seed'));
    assert.ok(result.maps.every(map => map.map === selectReplayMap('seed', match.id)));
    assert.ok(result.maps.length <= maxMaps);
    if (wins) assert.equal(Math.max(result.scoreA, result.scoreB), wins);
  }
});

test('NPC maps select the saved engine version instead of upgrading old Majors', () => {
  const teamA = { ...prepareReplayTeam(formatTeamForSimulation(catalog[0])), id: 'A', wins: 0, losses: 0 };
  const teamB = { ...prepareReplayTeam(formatTeamForSimulation(catalog[1])), id: 'B', wins: 0, losses: 0 };
  const match = { id: 'versioned-npc', round: 'Final', teamA, teamB };
  for (const simulation of [null, { ...CURRENT_SIMULATION, engineVersion: 2 }, CURRENT_SIMULATION]) {
    const result = simulateNpcMatch(match, 'versioned-major', simulation);
    for (const [index, map] of result.maps.entries()) {
      const plan = createMacroDirector(teamA, teamB, `versioned-major:${match.id}-map${index}`, simulation?.engineVersion ?? 2).plan;
      assert.equal(map.scoreA, plan.targetScore.A);
      assert.equal(map.scoreB, plan.targetScore.B);
      assert.equal(map.winnerId, plan.winnerTeam === 'A' ? 'A' : 'B');
    }
  }
});

test('map selection is stable and uses all maps across matches', () => {
  const selections = Array.from({ length: 100 }, (_, index) => selectReplayMap('major', String(index)));
  assert.deepEqual(selections, Array.from({ length: 100 }, (_, index) => selectReplayMap('major', String(index))));
  assert.ok(selections.filter(map => map === 'de_mirage').length > 20);
  assert.ok(selections.filter(map => map === 'de_dust2').length > 20);
  assert.ok(selections.filter(map => map === 'de_nuke').length > 20);
});
