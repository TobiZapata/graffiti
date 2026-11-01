import assert from 'node:assert/strict';
import test from 'node:test';
import { selectHighlightRounds } from '../src/lib/replayHighlights.mjs';
import { replayProgress } from '../src/lib/replayProgress.mjs';

function map(winners, clutches = []) {
  let scoreTeam1 = 0, scoreTeam2 = 0;
  return [...winners].map((winner, index) => {
    if (winner === 'A') scoreTeam1++; else scoreTeam2++;
    const round = index + 1;
    const half = round <= 24 ? (round <= 12 ? 1 : 2) : Math.floor((round - 25) % 6 / 3) + 1;
    return { round, clutch: clutches.includes(round) ? { actor_id: 'clutcher' } : null,
      macro: { scoreTeam1, scoreTeam2, teamASide: half === 1 ? 'T' : 'CT' } };
  });
}

test('highlights preserve mandatory rounds, one third, chronology and both nonpistol sides', () => {
  const rounds = map('AB'.repeat(10) + 'AAA', [5, 7]);
  const selected = selectHighlightRounds(rounds, 'map-1');
  assert.equal(selected.length, Math.ceil(rounds.length / 3));
  assert.deepEqual(selected, [...new Set(selected)].sort((a, b) => a - b));
  assert.deepEqual(selected, selectHighlightRounds(rounds, 'map-1'));
  for (const index of [0, 12, 22]) assert.ok(selected.includes(index));
  assert.ok(selected.some(index => rounds[index].clutch));
  for (const side of ['T', 'CT']) assert.ok(selected.some(index => ![1, 13].includes(rounds[index].round) && rounds[index].macro.teamASide === side));
});

test('matchpoint selects the opportunity to finish, not the round that reaches twelve', () => {
  const rounds = map('A'.repeat(12) + 'BBBBBA', [4]);
  const selected = selectHighlightRounds(rounds, 'matchpoint');
  assert.ok(selected.includes(12));
  assert.ok(selected.includes(17));
  assert.ok(selected.includes(3));
});

test('13-0 deduplicates second pistol, matchpoint and final without exceeding five', () => {
  const selected = selectHighlightRounds(map('A'.repeat(13), [13]), 'sweep');
  assert.equal(selected.length, 5);
  assert.ok(selected.includes(0));
  assert.ok(selected.includes(12));
});

test('overtime does not treat 12-12 as matchpoint and uses score fifteen', () => {
  const rounds = map('AB'.repeat(12) + 'AAABBA').slice(24);
  const selected = selectHighlightRounds(rounds, 'overtime');
  assert.deepEqual(selected, [3, 5]);
});

test('empty and short maps respect exact quota and maps without clutches still fill it', () => {
  assert.deepEqual(selectHighlightRounds([], 'empty'), []);
  assert.deepEqual(selectHighlightRounds(map('A'), 'short'), [0]);
  for (let n = 1; n <= 60; n++) {
    const rounds = map('AB'.repeat(30).slice(0, n));
    assert.equal(selectHighlightRounds(rounds, n).length, Math.ceil(n / 3));
  }
  assert.notDeepEqual(selectHighlightRounds(map('AB'.repeat(12)), 'a'), selectHighlightRounds(map('AB'.repeat(12)), 'b'));
});

test('jumping between highlights includes omitted rounds in score and player stats', () => {
  const rounds = map('A'.repeat(13));
  for (const info of rounds) {
    info.assignments = [{ actorId: '1', playerUid: 'A:1', name: 'A', team: 'A' }];
    info.actors = [{ actor_id: '1', kills: 1, deaths: 0, assists: 1, flash_assists: 1 }];
    info.winner_side = info.macro.teamASide;
  }
  const selected = selectHighlightRounds(rounds, 'progress');
  const index = selected.find((value, position) => position > 0 && value > selected[position - 1] + 1);
  assert.ok(index > 0);
  const round = { meta: rounds[index], sides: {} };
  const progress = replayProgress(rounds, index, round, { events: [], result: null });
  assert.deepEqual(progress.score, [index, 0]);
  assert.equal(progress.players[0].kills, index);
  assert.equal(progress.players[0].assists, index);
  assert.equal(progress.players[0].flashAssists, index);
  assert.deepEqual(replayProgress(rounds, index, round, { events: [], result: {} }).score, [index + 1, 0]);
});
