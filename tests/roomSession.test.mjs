import test from 'node:test';
import assert from 'node:assert/strict';
import { roomDeparture, roomSessionExpired, roomSessionsNeedReconciliation, SESSION_LEASE_MS } from '../src/lib/roomSession.mjs';

const host = { uid: 'host', participating: true, isReady: true, isHost: true, left: false };
const guest = { ...host, uid: 'guest', isHost: false };
const room = { hostId: 'host', status: 'lobby', players: [host, guest] };
test('lobby departures close for host, remove guests, and never count forfeits', () => {
  const left = roomDeparture(room, 'guest', 'navigation');
  assert.equal(left.forfeit, false);
  assert.equal(left.closed, false);
  assert.deepEqual(left.change.players, [host]);
  const closed = roomDeparture(room, 'host', 'reload');
  assert.equal(closed.closed, true);
  assert.equal(closed.forfeit, false);
  assert.equal(closed.change.status, 'closed');
  assert.equal(host.left, false);
});
test('Major departure transfers host and records only a participating unfinished Major', () => {
  const playing = { ...room, status: 'playing', tournament: { stage: 'swiss', abandonedUids: [] } };
  const departure = roomDeparture(playing, 'host', 'reload');
  assert.equal(departure.forfeit, true);
  assert.equal(departure.change.hostId, 'guest');
  assert.deepEqual(departure.change.tournament.abandonedUids, ['host']);
  assert.equal(roomDeparture({ ...playing, ...departure.change }, 'host', 'reload'), null);
  const empty = roomDeparture({ ...playing, ...departure.change }, 'guest', 'timeout');
  assert.equal(empty.change.tournament.stage, 'cancelled');
  assert.equal(empty.change.status, 'closed');
  assert.equal(roomDeparture({ ...playing, tournament: { stage: 'won' } }, 'guest', 'navigation').forfeit, false);
  assert.equal(roomDeparture({ ...playing, players: [host, { ...guest, participating: false }] }, 'guest', 'navigation').forfeit, false);
});

test('a lobby kick removes only its target and never records an abandonment', () => {
  const departure = roomDeparture(room, 'guest', 'kicked');
  assert.deepEqual(departure.change.players, [host]);
  assert.deepEqual(departure.change.lastDeparture, { uid: 'guest', reason: 'kicked' });
  assert.equal(departure.change.hostId, 'host');
  assert.equal(departure.forfeit, false);
  assert.equal(departure.closed, false);
  assert.deepEqual(room.players, [host, guest]);
});
test('presence expires after the lease or an explicit leaving signal, not visibility', () => {
  const now = 1000000;
  assert.equal(roomSessionExpired({ heartbeat: { toMillis: () => now - SESSION_LEASE_MS + 1 } }, now), false);
  assert.equal(roomSessionExpired({ heartbeat: { toMillis: () => now - SESSION_LEASE_MS } }, now), true);
  assert.equal(roomSessionExpired({ heartbeat: { toMillis: () => now }, leaving: true }, now), true);
  assert.equal(roomSessionExpired({ heartbeat: null }, now), false);
});

test('confirmed live peers avoid scans, but missing snapshots, departures and elapsed leases require server checks', () => {
  const now = 1000000;
  const fresh = { heartbeat: { toMillis: () => now } };
  const older = { heartbeat: { toMillis: () => now - SESSION_LEASE_MS + 1 } };
  assert.equal(roomSessionsNeedReconciliation(null, now), true);
  assert.equal(roomSessionsNeedReconciliation([fresh, older], now), false);
  assert.equal(roomSessionsNeedReconciliation([fresh, older], now + 1), true);
  assert.equal(roomSessionsNeedReconciliation([fresh, { ...fresh, leaving: true }], now), true);
  assert.equal(roomSessionsNeedReconciliation([{ heartbeat: null }, fresh], now), false);
  assert.equal(roomSessionsNeedReconciliation([], now), false);
});
