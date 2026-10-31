import test from 'node:test';
import assert from 'node:assert/strict';
import { replayProgress } from '../src/lib/replayProgress.mjs';

test('score and player stats follow sampled events and recompute when seeking', () => {
  const assignments = [{ actorId: '1', playerUid: 'A:1', name: 'A', team: 'A' }, { actorId: '2', playerUid: 'B:1', name: 'B', team: 'B' }, { actorId: '3', playerUid: 'A:2', name: 'C', team: 'A' }];
  const actors = assignments.map(a => ({ actor_id: a.actorId, kills: 0, deaths: 0, assists: 0, flash_assists: 0 }));
  actors[0].kills = 1; actors[1].deaths = 1;
  const first = { assignments, actors, macro: { scoreTeam1: 1, scoreTeam2: 0 } };
  const meta = { assignments, actors, macro: { teamASide: 'CT', scoreTeam1: 1, scoreTeam2: 1 }, winner_side: 'T' };
  const round = { meta, sides: { 1: 'CT', 2: 'T', 3: 'CT' } };
  const death = { type: 'player_death', attacker: '1', victim: '2', assister: '3', assistedflash: true, weapon: 'ak47' };
  const early = replayProgress([first, meta], 1, round, { events: [], result: null });
  assert.deepEqual(early.score, [1, 0]);
  assert.equal(early.players[0].kills, 1);
  const later = replayProgress([first, meta], 1, round, { events: [death], result: {} });
  assert.deepEqual(later.score, [1, 1]);
  assert.equal(later.players[0].kills, 2);
  assert.equal(later.players[1].deaths, 2);
  assert.equal(later.players[2].flashAssists, 1);
  assert.deepEqual(replayProgress([first, meta], 1, round, { events: [], result: null }), early);
  const excluded = replayProgress([first, meta], 1, round, { events: [{ ...death, weapon: 'c4' }, { ...death, victim: '3' }], result: null });
  assert.equal(excluded.players[0].kills, 1);
});
