import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moveOrganizationRole } from '../src/lib/organizationRoles.mjs';

const org = { id: 'id', name: 'Team', icon: '/icon', colors: ['#123456', '#abcdef'], squad: Array.from({ length: 5 }, (_, i) => ({ player: { name: `P${i}` } })), mainAwperUid: '0', iglUid: '1', starUid: '2', createdAt: '2026-01-01', majorHistory: [] };

test('moving IGL or AWPer onto the other swaps their holders without mutation', () => {
  const before = structuredClone(org);
  const igl = moveOrganizationRole(org, 'iglUid', '0');
  assert.equal(igl.iglUid, '0');
  assert.equal(igl.mainAwperUid, '1');
  const awper = moveOrganizationRole(org, 'mainAwperUid', '1');
  assert.equal(awper.mainAwperUid, '1');
  assert.equal(awper.iglUid, '0');
  assert.deepEqual(org, before);
  assert.equal(igl.squad, org.squad);
  assert.equal(igl.majorHistory, org.majorHistory);
});

test('STAR can overlap another role and same holder is a no-op', () => {
  assert.equal(moveOrganizationRole(org, 'starUid', '0').starUid, '0');
  assert.equal(moveOrganizationRole(org, 'starUid', '1').starUid, '1');
  assert.equal(moveOrganizationRole(org, 'starUid', '2'), org);
});

test('rejects invalid fields, targets and organizations', () => {
  assert.throws(() => moveOrganizationRole(org, 'name', '0'));
  for (const uid of ['5', '01', 1, null]) assert.throws(() => moveOrganizationRole(org, 'iglUid', uid));
  assert.throws(() => moveOrganizationRole({ ...org, squad: [] }, 'iglUid', '0'));
});
