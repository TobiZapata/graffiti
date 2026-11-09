import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareReplayTeam } from '../src/lib/replayTeam.mjs';

const team = () => ({ name: 'Team', players: [
  { name: 'A', id: 1, rol1: 'awper', aim: 85 },
  { name: 'B', id: 1, role: 'IGL', gamesense: 90 },
  { name: 'C', aim: 99 }, { name: 'D' }, { name: 'E' },
] });

test('infers NPC roles and normalizes duplicate IDs and ratings', () => {
  const result = prepareReplayTeam(team());
  assert.equal(result.mainAwperUid, result.players[0].uid);
  assert.equal(result.iglUid, result.players[1].uid);
  assert.equal(new Set(result.players.map(p => p.uid)).size, 5);
  assert.ok(result.players.every(p => typeof p.uid === 'string'));
});

test('keeps explicit roles and rejects invalid selections including allowing dual roles', () => {
  const input = team(); input.mainAwperUid = '2'; input.iglUid = 'slot-1';
  const result = prepareReplayTeam(input);
  assert.equal(result.mainAwperUid, '2'); assert.equal(result.iglUid, 'slot-1');
  assert.equal(prepareReplayTeam({ ...input, iglUid: '2' }).iglUid, '2');
  assert.throws(() => prepareReplayTeam({ ...input, iglUid: 'missing' }));
  input.players[4].name = 'A'; assert.throws(() => prepareReplayTeam(input));
});

test('fallback roles are distinct and stats are bounded', () => {
  const input = team(); input.players.forEach(p => { delete p.role; delete p.rol1; });
  input.players[2].aim = 500;
  const result = prepareReplayTeam(input);
  assert.equal(result.players[2].aim, 100);
  assert.equal(result.mainAwperUid, result.players[2].uid);
  assert.notEqual(result.mainAwperUid, result.iglUid);
});
