import { test } from 'node:test';
import { deepStrictEqual } from 'node:assert';
import { decodeRoom, encodePlayers } from '../src/lib/roomStorage.mjs';

test('room members decode host first and other UIDs in order, including legacy arrays', () => {
  const players = [{ uid: 'z' }, { uid: 'b' }, { uid: 'a' }];
  deepStrictEqual(decodeRoom({ hostId: 'b', players: encodePlayers(players) }).players.map(p => p.uid), ['b', 'a', 'z']);
  deepStrictEqual(decodeRoom({ hostId: 'b', players }).players.map(p => p.uid), ['b', 'a', 'z']);
});
