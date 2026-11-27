import test from 'node:test';
import assert from 'node:assert/strict';
import { ABANDONMENTS_KEY, countLocalAbandonments, loadLocalAbandonments, recordLocalAbandonment } from '../src/lib/localAbandonments.mjs';

const entry = {
  organizationId: 'team-a',
  roomId: 'ABCD',
  tournamentId: 'major-1',
  reason: 'left',
  at: '2026-11-26T12:00:00.000Z',
};

function storage(initial = null) {
  const values = new Map(initial === null ? [] : [[ABANDONMENTS_KEY, initial]]);
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

test('absent storage and empty storage return no abandonments', () => {
  assert.deepEqual(loadLocalAbandonments(), []);
  assert.deepEqual(loadLocalAbandonments(storage()), []);
  assert.equal(countLocalAbandonments(storage(), entry.organizationId), 0);
  assert.equal(recordLocalAbandonment(undefined, entry), false);
});

test('corrupt JSON and invalid records are ignored', () => {
  assert.deepEqual(loadLocalAbandonments(storage('{')), []);
  assert.deepEqual(loadLocalAbandonments(storage('{}')), []);
  const saved = storage(JSON.stringify([null, { ...entry, organizationId: '' }, { ...entry, at: 'invalid' }, entry]));
  assert.deepEqual(loadLocalAbandonments(saved), [entry]);
});

test('records valid entries and counts by organization', () => {
  const saved = storage();
  assert.equal(recordLocalAbandonment(saved, { ...entry, tournamentId: '' }), false);
  assert.equal(recordLocalAbandonment(saved, entry), true);
  assert.deepEqual(loadLocalAbandonments(saved), [entry]);
  assert.equal(recordLocalAbandonment(saved, { ...entry, tournamentId: 'major-2', at: undefined }), true);
  assert.ok(Number.isFinite(Date.parse(loadLocalAbandonments(saved)[1].at)));
  assert.equal(countLocalAbandonments(saved, entry.organizationId), 2);
  assert.equal(countLocalAbandonments(saved), 0);
});

test('deduplicates by organization and tournament, allowing the same tournament for another organization', () => {
  const saved = storage();
  assert.equal(recordLocalAbandonment(saved, entry), true);
  assert.equal(recordLocalAbandonment(saved, { ...entry, roomId: 'EFGH' }), false);
  assert.equal(recordLocalAbandonment(saved, { ...entry, organizationId: 'team-b' }), true);
  assert.equal(countLocalAbandonments(saved, 'team-a'), 1);
  assert.equal(countLocalAbandonments(saved, 'team-b'), 1);
  assert.equal(countLocalAbandonments(saved, 'team-c'), 0);
});
