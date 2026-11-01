import assert from 'node:assert/strict';
import fs from 'node:fs';
import { initializeApp, deleteApp } from 'firebase/app';
import { initializeFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, updateDoc, deleteDoc, terminate } from 'firebase/firestore';

// Only probes an isolated demo namespace on localhost; never connects to a cloud database.
const rulesPath = process.argv[2];
const outputPath = process.argv[3];
if (!rulesPath || !outputPath) throw new Error('Usage: node scripts/probe-firestore-permissions.mjs <rules-snapshot.json> <report.json>');
const snapshot = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
assert.ok(Array.isArray(snapshot.files) && snapshot.files.length > 0, 'a rules snapshot is required');
const project = `demo-major-permissions-${Date.now()}`;
const origin = 'http://127.0.0.1:8088';
const documents = `${origin}/v1/projects/${project}/databases/(default)/documents`;
const clients = [];

async function loadRules(files) {
  const response = await fetch(`${origin}/emulator/v1/projects/${project}:securityRules`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rules: { files } }), signal: AbortSignal.timeout(10000),
  });
  assert.ok(response.ok, 'the isolated emulator rules were loaded');
  const result = await response.json();
  assert.ok(!(result.issues || []).some(issue => issue.severity === 'ERROR'), 'rules compile');
}

function client(uid) {
  const app = initializeApp({ projectId: project, apiKey: 'demo-only', appId: 'demo-only' }, `${project}-${uid || 'signed-out'}`);
  const db = initializeFirestore(app, {});
  connectFirestoreEmulator(db, '127.0.0.1', 8088, uid ? { mockUserToken: { sub: uid, user_id: uid } } : {});
  clients.push({ app, db });
  return db;
}

const denied = async action => {
  try { await action(); return false; }
  catch (error) { if (error.code === 'permission-denied') return true; throw error; }
};

function encode(value) {
  if (value === null) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return { integerValue: String(value) };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encode(item)])) } };
}

async function seed(path, data) {
  const response = await fetch(`${documents}/${path}`, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: encode(data).mapValue.fields }), signal: AbortSignal.timeout(10000) });
  assert.ok(response.ok, 'only test fixtures are seeded with emulator admin access');
}

try {
  const host = client('host'), guest = client('guest'), outsider = client('outsider'), anonymous = client(null);
  // This control verifies that SDK requests really reach the rules with distinct identities.
  await loadRules([{ name: 'control.rules', content: "rules_version = '2'; service cloud.firestore { match /databases/{database}/documents { match /control/{id} { allow write: if request.auth != null && request.auth.uid == 'host'; } } }" }]);
  assert.equal(await denied(() => setDoc(doc(host, 'control/check'), { ok: true })), false);
  assert.equal(await denied(() => setDoc(doc(guest, 'control/check'), { ok: false })), true);
  assert.equal(await denied(() => setDoc(doc(anonymous, 'control/check'), { ok: false })), true);
  await loadRules(snapshot.files);

  const fixture = { id: 'TEST', hostId: 'host', status: 'lobby', visibility: 'private', generation: 0, players: [{ uid: 'host', isReady: false }, { uid: 'guest', isReady: false }] };
  const cases = [
    ['signed-out user reads a private room', anonymous, ref => getDoc(ref)],
    ['signed-out user creates a room', anonymous, ref => setDoc(ref, fixture)],
    ['outsider changes the host', outsider, ref => updateDoc(ref, { hostId: 'outsider' })],
    ['outsider edits another player', outsider, ref => updateDoc(ref, { players: [{ uid: 'host', isReady: true }] })],
    ['guest starts or advances the Major', guest, ref => updateDoc(ref, { status: 'playing', tournament: { stage: 'playoffs', tournamentId: 'forged' } })],
    ['outsider forges match results', outsider, ref => updateDoc(ref, { tournament: { matches: [{ id: 'forged', completed: true, result: { winner: 'outsider' } }] } })],
    ['outsider deletes a room', outsider, ref => deleteDoc(ref)],
  ];
  const results = [];
  for (const [index, [name, db, action]] of cases.entries()) {
    const path = `rooms/probe-${index}`;
    await seed(path, fixture);
    results.push({ name, expected: 'denied', actual: await denied(() => action(doc(db, path))) ? 'denied' : 'allowed' });
  }
  results.push({ name: 'outsider creates an organization lock for another user', expected: 'denied', actual: await denied(() => setDoc(doc(outsider, 'organizationSessions/test-org'), { ownerUid: 'host', roomId: 'TEST', tournamentId: 'forged' })) ? 'denied' : 'allowed' });
  const report = { project: snapshot.project, emulatorProject: project, cloudWrites: false, identityControlPassed: true, rulesRelease: snapshot.release?.rulesetName, checkedAt: new Date().toISOString(), passed: results.filter(result => result.expected === result.actual).length, failed: results.filter(result => result.expected !== result.actual).length, results };
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  if (report.failed) process.exitCode = 1;
} finally {
  for (const { app, db } of clients) { await terminate(db); await deleteApp(app); }
  const response = await fetch(`${origin}/emulator/v1/projects/${project}/databases/(default)/documents`, { method: 'DELETE', signal: AbortSignal.timeout(10000) });
  assert.ok(response.ok, 'the isolated test namespace was cleaned');
}
