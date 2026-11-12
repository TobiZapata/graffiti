import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { initializeApp, deleteApp } from 'firebase/app';
import { initializeFirestore, connectFirestoreEmulator, doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc, deleteField, query, where, limit, writeBatch, terminate, setLogLevel, serverTimestamp } from 'firebase/firestore';

// Fixed localhost endpoint and demo namespace prevent this test from reaching cloud Firestore.
const project = `demo-major-security-${randomUUID()}`;
const origin = 'http://127.0.0.1:8088';
const documents = `${origin}/v1/projects/${project}/databases/(default)/documents`;
const clients = [];
setLogLevel('silent');
let passed = 0, failed = 0;
async function loadRules(content) {
  const response = await fetch(`${origin}/emulator/v1/projects/${project}:securityRules`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rules: { files: [{ name: 'firestore.rules', content }] } }), signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('rules load failed: ' + await response.text());
  const result = await response.json();
  assert.ok(!(result.issues || []).some(i => i.severity === 'ERROR'), JSON.stringify(result.issues));
}
function client(uid) {
  const app = initializeApp({ projectId: project, apiKey: 'demo-only', appId: 'demo-only' }, `${project}-${uid || 'anonymous'}`);
  const db = initializeFirestore(app, {});
  connectFirestoreEmulator(db, '127.0.0.1', 8088, uid ? { mockUserToken: { sub: uid, user_id: uid } } : {});
  clients.push({ app, db });
  return db;
}
function encode(value) {
  if (value === null) return { nullValue: null };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return { integerValue: String(value) };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encode(item)])) } };
}
async function seed(path, data) {
  const response = await fetch(`${documents}/${path}`, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: encode(data).mapValue.fields }), signal: AbortSignal.timeout(10000) });
  assert.ok(response.ok, `fixture seed failed: ${path}`);
  if (/^rooms\/[^/]+$/.test(path)) {
    for (const uid of Object.keys(data.players)) await seed(`roomSessions/${uid}`, session(uid, data.id, new Date()));
  }
}
const session = (uid, roomId, heartbeat = serverTimestamp()) => ({ uid, roomId, pageId: `page-${uid}`, tabId: `tab-${uid}`, heartbeat, leaving: false });
async function check(name, allowed, action) {
  try {
    await action();
    assert.ok(allowed, 'unexpectedly allowed');
    passed++;
  } catch (error) {
    if (!allowed && error.code === 'permission-denied') { passed++; return; }
    failed++;
    console.error(`FAIL ${name}: ${error.message}`);
  }
}
const member = (uid, isHost = false) => {
  const squad = Array.from({ length: 5 }, (_, i) => ({ player: { name: `${uid}-${i}` } }));
  const organization = { id: `org-${uid}`, name: uid, icon: 'icon', colors: ['#000000', '#ffffff'], squad, mainAwperUid: '0', iglUid: '1', starUid: '2', createdAt: '2026-01-01' };
  return { uid, name: uid, isHost, organization, squad, teamName: uid, icon: 'icon', participating: true, isReady: false, sessionId: `page-${uid}`, left: false };
};
const hostMember = member('host', true), guestMember = member('guest');
const lobby = (id, visibility = 'private') => ({ id, hostId: 'host', status: 'lobby', visibility, schemaVersion: 3, generation: 0, createdAt: '2026-01-01', players: { host: hostMember, guest: guestMember } });
const teamA = { id: 'a', name: 'A' }, teamB = { id: 'b', name: 'B' };
const match = { id: 'match1', teamA, teamB, playerUids: ['host', 'guest'], completed: false, round: 1, isPlayerMatch: true };
const tournament = { tournamentId: 'major1', participantUids: ['host', 'guest'], matchesStarted: true, stage: 'swiss', swissRound: 1, matches: [match], standings: [] };
const playing = id => ({ ...lobby(id), status: 'playing', generation: 1, tournament });
const result = { teamA, teamB, winner: 'a', scoreA: 13, scoreB: 7, maps: [{ map: 'de_mirage', scoreA: 13, scoreB: 7, winnerId: 'a' }] };
const submission = { tournamentId: 'major1', matchId: 'match1', matchIndex: 0, submittedBy: 'host', result };
function depart(db, roomId, uid, changes, reason = 'navigation', record = true, releaseLock = false, major = 'major1') {
  const batch = writeBatch(db);
  batch.update(doc(db, `rooms/${roomId}`), { ...changes, lastDeparture: { uid, reason } });
  batch.delete(doc(db, `roomSessions/${uid}`));
  if (releaseLock) batch.delete(doc(db, `organizationSessions/org-${uid}`));
  if (record) batch.set(doc(db, `users/${uid}/abandonments/${major}`), { ownerUid: uid, organizationId: `org-${uid}`, roomId, tournamentId: major, reason, at: serverTimestamp() });
  return batch.commit();
}

try {
  const host = client('host'), guest = client('guest'), outsider = client('outsider'), racer = client('racer'), anonymous = client(null);
  await loadRules("rules_version = '2'; service cloud.firestore { match /databases/{database}/documents { match /control/{id} { allow write: if request.auth != null && request.auth.uid == 'host'; } } }");
  await check('identity control host', true, () => setDoc(doc(host, 'control/check'), { ok: true }));
  await check('identity control guest', false, () => setDoc(doc(guest, 'control/check'), { ok: true }));
  await check('identity control signed out', false, () => setDoc(doc(anonymous, 'control/check'), { ok: true }));
  await loadRules(fs.readFileSync('firestore.rules', 'utf8'));

  for (const [id, title, allowed] of [['RN01', 'A'.repeat(35), true], ['RN02', 'A'.repeat(36), false], ['RN03', '', false], ['RN04', 123, false]]) {
    const uid = `name-${id}`, db = client(uid);
    await check(`room name ${id}`, allowed, async () => {
      const batch = writeBatch(db);
      batch.set(doc(db, `rooms/${id}`), { ...lobby(id), name: title, hostId: uid, players: { [uid]: member(uid, true) } });
      batch.set(doc(db, `roomSessions/${uid}`), session(uid, id));
      await batch.commit();
    });
    if (allowed) await check('room name remains fixed after creation', false, () => updateDoc(doc(db, `rooms/${id}`), { name: 'Changed' }));
  }
  for (const [id, length, allowed] of [['ON28', 28, true], ['ON29', 29, true], ['ON00', 100, true], ['ON01', 101, false]]) {
    const uid = `org-${id}`, db = client(uid), player = member(uid, true);
    player.organization.name = player.teamName = 'A'.repeat(length);
    await check(`organization name ${length} characters`, allowed, async () => {
      const batch = writeBatch(db);
      batch.set(doc(db, `rooms/${id}`), { ...lobby(id), hostId: uid, players: { [uid]: player } });
      batch.set(doc(db, `roomSessions/${uid}`), session(uid, id));
      await batch.commit();
    });
  }

  for (const [id, mode, allowed] of [['MF01', 'full', true], ['MH01', 'highlights', true], ['MI01', 'invalid', false]]) {
    const uid = `mode-${id}`, db = client(uid);
    await check(`room playback mode ${mode}`, allowed, async () => {
      const batch = writeBatch(db);
      batch.set(doc(db, `rooms/${id}`), { ...lobby(id), hostId: uid, playbackMode: mode, players: { [uid]: member(uid, true) } });
      batch.set(doc(db, `roomSessions/${uid}`), session(uid, id));
      await batch.commit();
    });
    if (allowed) {
      await check(`host cannot change playback mode ${mode}`, false, () => updateDoc(doc(db, `rooms/${id}`), { playbackMode: mode === 'full' ? 'highlights' : 'full' }));
      await check(`host cannot remove playback mode ${mode}`, false, () => updateDoc(doc(db, `rooms/${id}`), { playbackMode: deleteField() }));
    }
  }

  await check('authenticated room creation and claim', true, async () => {
    const batch = writeBatch(host);
    batch.set(doc(host, 'rooms/NEW1'), { ...lobby('NEW1'), players: { host: hostMember } });
    batch.set(doc(host, 'roomSessions/host'), session('host', 'NEW1'));
    await batch.commit();
  });
  await check('second room cannot replace claim', false, async () => {
    const batch = writeBatch(host);
    batch.set(doc(host, 'rooms/NEW3'), { ...lobby('NEW3'), players: { host: hostMember } });
    batch.set(doc(host, 'roomSessions/host'), session('host', 'NEW3'));
    await batch.commit();
  });
  await check('second tab cannot replace claim', false, () => setDoc(doc(host, 'roomSessions/host'), { ...session('host', 'NEW1'), pageId: 'other-page', tabId: 'other-tab' }));
  await check('owner heartbeat', true, () => updateDoc(doc(host, 'roomSessions/host'), { heartbeat: serverTimestamp() }));
  await check('heartbeat spoof', false, () => updateDoc(doc(guest, 'roomSessions/host'), { heartbeat: serverTimestamp() }));
  await check('heartbeat rebind', false, () => updateDoc(doc(host, 'roomSessions/host'), { heartbeat: serverTimestamp(), roomId: 'NEW3' }));
  await check('heartbeat cannot change page', false, () => updateDoc(doc(host, 'roomSessions/host'), { heartbeat: serverTimestamp(), pageId: 'other-page' }));
  await check('claim without membership', false, () => setDoc(doc(outsider, 'roomSessions/outsider'), session('outsider', 'NEW1')));
  await check('simultaneous tabs create only one room', true, async () => {
    const attempts = await Promise.allSettled(['RA01', 'RA02'].map(id => {
      const batch = writeBatch(racer);
      batch.set(doc(racer, `rooms/${id}`), { ...lobby(id), hostId: 'racer', players: { racer: { ...member('racer', true), sessionId: `page-${id}` } } });
      batch.set(doc(racer, 'roomSessions/racer'), { ...session('racer', id), pageId: `page-${id}`, tabId: `tab-${id}` });
      return batch.commit();
    }));
    assert.equal(attempts.filter(a => a.status === 'fulfilled').length, 1);
    assert.equal(attempts.filter(a => a.status === 'rejected' && a.reason.code === 'permission-denied').length, 1);
  });
  await check('signed-out room creation', false, () => setDoc(doc(anonymous, 'rooms/NEW2'), { ...lobby('NEW2'), players: { host: hostMember } }));
  await check('invalid organization cannot create room', false, () => setDoc(doc(host, 'rooms/BAD1'), { ...lobby('BAD1'), players: { host: { ...hostMember, organization: { ...hostMember.organization, mainAwperUid: '5' } } } }));
  for (const [index, score, allowed] of [[0,80,true],[1,101,false],[2,null,false],[3,'80',false],[4,1.5,false],[5,undefined,false]]) {
    const id=`V2${index}A`, uid=`v2-${index}`, db=client(uid), p=member(uid,true);
    const squad=p.squad.map(s=>({player:{...s.player,awp:70,rifler:80,igl:60,firepower:score,clutch:90}}));
    if (score === undefined) squad.forEach(s=>delete s.player.firepower);
    const candidate={...p,squad,organization:{...p.organization,squad,iglUid:'0'}};
    await check(`v2 score validation and dual roles ${index}`,allowed,async()=>{
      const batch=writeBatch(db);
      batch.set(doc(db,`rooms/${id}`),{...lobby(id),hostId:uid,players:{[uid]:candidate}});
      batch.set(doc(db,`roomSessions/${uid}`),session(uid,id));
      await batch.commit();
    });
    if (allowed) {
      await check('v2 ready update retains dual roles',true,()=>updateDoc(doc(db,`rooms/${id}`),{[`players.${uid}.isReady`]:true}));
      await check('v2 cannot update score outside range',false,()=>updateDoc(doc(db,`rooms/${id}`),{[`players.${uid}.organization.squad`]:squad.map((s,i)=>i ? s : {player:{...s.player,clutch:101}}),[`players.${uid}.squad`]:squad.map((s,i)=>i ? s : {player:{...s.player,clutch:101}})}));
    }
  }
  await seed('rooms/PRIVATE', lobby('PRIVATE'));
  await seed('rooms/PUBLIC', lobby('PUBLIC', 'public'));
  await seed('roomSessions/host', session('host', 'PRIVATE', new Date()));
  await seed('roomSessions/guest', session('guest', 'PRIVATE', new Date()));
  await check('signed-in private lookup', true, () => getDoc(doc(outsider, 'rooms/PRIVATE')));
  await check('signed-out private lookup', false, () => getDoc(doc(anonymous, 'rooms/PRIVATE')));
  await check('signed-out public lookup', false, () => getDoc(doc(anonymous, 'rooms/PUBLIC')));
  await check('public directory excludes private rooms', true, async () => {
    const snapshot = await getDocs(query(collection(outsider, 'rooms'), where('visibility', '==', 'public'), where('status', '==', 'lobby'), limit(50)));
    assert.deepEqual(snapshot.docs.map(d => d.id), ['PUBLIC']);
  });
  await check('private directory denied', false, () => getDocs(query(collection(outsider, 'rooms'), where('visibility', '==', 'private'))));
  await check('join without claim', false, () => updateDoc(doc(outsider, 'rooms/PRIVATE'), { 'players.outsider': member('outsider') }));
  await check('own join and claim', true, async () => {
    const batch = writeBatch(outsider);
    batch.update(doc(outsider, 'rooms/PRIVATE'), { 'players.outsider': member('outsider') });
    batch.set(doc(outsider, 'roomSessions/outsider'), session('outsider', 'PRIVATE'));
    await batch.commit();
  });
  await check('own ready', true, () => updateDoc(doc(outsider, 'rooms/PRIVATE'), { 'players.outsider.isReady': true }));
  const teams = JSON.parse(fs.readFileSync('src/data/teams.json', 'utf8'));
  const realMember = (uid, index, isHost) => {
    const p = member(uid, isHost);
    const squad = teams[index].players.map(player => ({ player, team: { name: teams[index].name, major: teams[index].major } }));
    return { ...p, squad, organization: { ...p.organization, squad } };
  };
  await seed('rooms/REAL', { ...lobby('REAL'), players: { host: realMember('host', 0, true), guest: realMember('guest', 1, false) } });
  await check('real roster guest ready', true, () => updateDoc(doc(guest, 'rooms/REAL'), { 'players.guest.isReady': true }));
  await check('real roster host ready after guest', true, () => updateDoc(doc(host, 'rooms/REAL'), { 'players.host.isReady': true }));
  await seed('rooms/REALMAP', { ...lobby('REALMAP'), players: { host: realMember('host', 0, true), guest: { ...realMember('guest', 1, false), isReady: true } } });
  await check('real roster host ready with full players map', true, () => updateDoc(doc(host, 'rooms/REALMAP'), { players: { host: { ...realMember('host', 0, true), isReady: true }, guest: { ...realMember('guest', 1, false), isReady: true } } }));
  const maxUids=['host','guest',...Array.from({length:6},(_,i)=>`max-${i}`)];
  const maxMembers=Object.fromEntries(maxUids.map((uid,i)=>{
    const p=realMember(uid,i,i===0), squad=p.squad.map(s=>({...s,player:{...s.player,awp:100,rifler:0,igl:80,firepower:85,clutch:70}}));
    return [uid,{...p,isReady:i!==7,squad,organization:{...p.organization,squad,iglUid:'0'}}];
  }));
  const maxRoom={...lobby('MAX8'),players:Object.fromEntries(Object.entries(maxMembers).slice(0,7))};
  await seed('rooms/MAX8',maxRoom);
  const lastUid=maxUids[7],lastClient=client(lastUid);
  await check('eighth v2 member joins with a full roster and shared roles',true,async()=>{
    const batch=writeBatch(lastClient);
    batch.update(doc(lastClient,'rooms/MAX8'),{[`players.${lastUid}`]:maxMembers[lastUid]});
    batch.set(doc(lastClient,`roomSessions/${lastUid}`),session(lastUid,'MAX8'));
    await batch.commit();
  });
  await check('eighth v2 member readies in a full room',true,()=>updateDoc(doc(lastClient,'rooms/MAX8'),{[`players.${lastUid}.isReady`]:true}));
  await check('v2 roles update in a full room keeps shared assignment',true,()=>updateDoc(doc(host,'rooms/MAX8'),{'players.host.organization.mainAwperUid':'2','players.host.organization.iglUid':'2'}));
  const maxTournament={...tournament,simulation:{engineVersion:3,playerDataVersion:'players-v2.0.0',bankVersion:'mirage-economy-v1'},matchesStarted:false,participantUids:maxUids};
  await check('unknown simulation cannot start a major',false,()=>updateDoc(doc(host,'rooms/MAX8'),{status:'playing',generation:1,tournament:{...maxTournament,simulation:{...maxTournament.simulation,engineVersion:999}}}));
  await check('eight v2 members start with all organization locks',true,async()=>{
    const batch=writeBatch(host);
    batch.update(doc(host,'rooms/MAX8'),{status:'playing',generation:1,tournament:maxTournament});
    for (const uid of maxUids) batch.set(doc(host,`organizationSessions/org-${uid}`),{ownerUid:uid,roomId:'MAX8',tournamentId:maxTournament.tournamentId});
    await batch.commit();
  });
  await check('edit another member', false, () => updateDoc(doc(outsider, 'rooms/PRIVATE'), { 'players.guest.isReady': true }));
  await check('own navigation leave', true, async () => {
    const batch = writeBatch(outsider);
    batch.update(doc(outsider, 'rooms/PRIVATE'), { 'players.outsider': deleteField(), lastDeparture: { uid: 'outsider', reason: 'navigation' } });
    batch.delete(doc(outsider, 'roomSessions/outsider'));
    await batch.commit();
  });
  await check('lobby leave records no abandonment', true, async () => assert.equal((await getDoc(doc(outsider, 'users/outsider/abandonments/major1'))).exists(), false));
  await seed('rooms/TRANSFER', lobby('TRANSFER'));
  await check('host closes lobby on departure', true, async () => {
    const batch = writeBatch(host);
    batch.update(doc(host, 'rooms/TRANSFER'), { status: 'closed', closedReason: 'host-left', 'players.host.left': true, 'players.host.isReady': false, lastDeparture: { uid: 'host', reason: 'navigation' } });
    batch.delete(doc(host, 'roomSessions/host'));
    await batch.commit();
  });
  await seed('rooms/STALE', lobby('STALE'));
  await seed('rooms/STALE/results/major1~match1', submission);
  await check('outsider cannot read live host results', false, () => getDoc(doc(outsider, 'rooms/STALE/results/major1~match1')));
  await seed('roomSessions/host', session('host', 'STALE', new Date(Date.now() - 181000)));
  await check('expired heartbeat cannot be revived', false, () => updateDoc(doc(host, 'roomSessions/host'), { heartbeat: serverTimestamp() }));
  await check('outsider reads stale host results for cleanup', true, () => getDoc(doc(outsider, 'rooms/STALE/results/major1~match1')));
  await check('outsider closes stale host lobby and deletes results', true, async () => {
    const batch = writeBatch(outsider);
    batch.update(doc(outsider, 'rooms/STALE'), { status: 'closed', closedReason: 'host-left', 'players.host.left': true, lastDeparture: { uid: 'host', reason: 'timeout' } });
    batch.delete(doc(outsider, 'roomSessions/host'));
    batch.delete(doc(outsider, 'rooms/STALE/results/major1~match1'));
    await batch.commit();
  });
  await seed('rooms/STALE2', lobby('STALE2'));
  await seed('rooms/STALE2/results/major1~match1', submission);
  await seed('roomSessions/host', session('host', 'STALE2', new Date(Date.now() - 181000)));
  await check('stale host can close before results cleanup', true, () => depart(outsider, 'STALE2', 'host', { status: 'closed', closedReason: 'host-left', 'players.host.left': true }, 'timeout', false));
  await check('outsider reads closed room results after claim deletion', true, () => getDoc(doc(outsider, 'rooms/STALE2/results/major1~match1')));
  await check('outsider deletes closed room results', true, () => deleteDoc(doc(outsider, 'rooms/STALE2/results/major1~match1')));
  await seed('roomSessions/host', session('host', 'PRIVATE', new Date()));
  await seed('roomSessions/guest', session('guest', 'PRIVATE', new Date()));
  await check('guest participation change', false, () => updateDoc(doc(guest, 'rooms/PRIVATE'), { 'players.guest.participating': false }));
  await check('host participation change', false, () => updateDoc(doc(host, 'rooms/PRIVATE'), { 'players.guest.participating': false }));
  await seed('rooms/LEGACY', { ...lobby('LEGACY'), players: { host: hostMember, guest: { ...guestMember, participating: false } } });
  await check('legacy guest restores participation while readying', true, () => updateDoc(doc(guest, 'rooms/LEGACY'), { 'players.guest.participating': true, 'players.guest.isReady': true }));
  await seed('rooms/LEGACYORG', { ...lobby('LEGACYORG'), players: { host: hostMember, guest: { ...guestMember, participating: false } } });
  const updatedGuest = member('guest');
  updatedGuest.organization.name = 'Updated organization';
  updatedGuest.teamName = updatedGuest.organization.name;
  await check('legacy guest updates organization and restores participation', true, () => updateDoc(doc(guest, 'rooms/LEGACYORG'), { 'players.guest': { ...updatedGuest, isReady: true } }));
  await seed('rooms/KICK', lobby('KICK'));
  const kick = (db, uid = 'guest', changes = {}) => depart(db, 'KICK', uid, { [`players.${uid}`]: deleteField(), ...changes }, 'kicked', false);
  await check('guest cannot kick', false, () => kick(guest, 'host'));
  await check('outsider cannot kick', false, () => kick(outsider));
  await check('host cannot kick self', false, () => kick(host, 'host'));
  await check('kick needs session removal', false, () => updateDoc(doc(host, 'rooms/KICK'), { 'players.guest': deleteField(), lastDeparture: { uid: 'guest', reason: 'kicked' } }));
  await check('kick rejects collateral changes', false, () => kick(host, 'guest', { visibility: 'public' }));
  await check('kick rejects changes to another member', false, () => kick(host, 'guest', { 'players.host.name': 'changed' }));
  await check('kick rejects wrong departure metadata', false, () => depart(host, 'KICK', 'guest', { 'players.guest': deleteField() }, 'timeout', false));
  await seed('roomSessions/guest', { ...session('guest', 'KICK', new Date()), pageId: 'wrong-page' });
  await check('kick rejects session from another page', false, () => kick(host));
  await seed('roomSessions/guest', session('guest', 'KICK', new Date()));
  await check('host kicks active guest', true, () => kick(host));
  await check('kick releases guest session', true, async () => assert.equal((await getDoc(doc(guest, 'roomSessions/guest'))).exists(), false));
  await seed('rooms/JOIN', { ...lobby('JOIN'), players: { host: hostMember } });
  await check('kicked guest can join another room', true, async () => {
    const batch = writeBatch(guest);
    batch.update(doc(guest, 'rooms/JOIN'), { 'players.guest': guestMember });
    batch.set(doc(guest, 'roomSessions/guest'), session('guest', 'JOIN'));
    await batch.commit();
  });
  await seed('rooms/KPLAY', playing('KPLAY'));
  await check('host cannot kick during Major', false, () => depart(host, 'KPLAY', 'guest', { 'players.guest': deleteField() }, 'kicked', false));
  await seed('roomSessions/host', session('host', 'PRIVATE', new Date()));
  await seed('roomSessions/guest', session('guest', 'PRIVATE', new Date()));
  await check('guest start', false, () => updateDoc(doc(guest, 'rooms/PRIVATE'), { status: 'playing', generation: 1, tournament }));
  await seed('rooms/PLAYING', playing('PLAYING'));
  await check('join during Major', false, () => updateDoc(doc(outsider, 'rooms/PLAYING'), { 'players.outsider': member('outsider') }));
  await check('guest advances', false, () => updateDoc(doc(guest, 'rooms/PLAYING'), { 'tournament.stage': 'playoffs' }));
  await check('host advances', true, () => updateDoc(doc(host, 'rooms/PLAYING'), { 'tournament.stage': 'playoffs' }));
  const simulation={engineVersion:2,playerDataVersion:'players-v2.0.0',bankVersion:'mirage-economy-v1'};
  await check('legacy major cannot change simulation version',false,()=>updateDoc(doc(host,'rooms/PLAYING'),{'tournament.simulation':simulation}));
  await seed('rooms/PLAYV2',{...playing('PLAYV2'),tournament:{...tournament,simulation}});
  await check('v2 host advances with fixed simulation',true,()=>updateDoc(doc(host,'rooms/PLAYV2'),{'tournament.stage':'playoffs'}));
  await check('v2 host cannot remove simulation version',false,()=>updateDoc(doc(host,'rooms/PLAYV2'),{'tournament.simulation':deleteField()}));
  await check('v2 host cannot change simulation version',false,()=>updateDoc(doc(host,'rooms/PLAYV2'),{'tournament.simulation':{...simulation,engineVersion:3}}));
  await seed('rooms/DEPART', playing('DEPART'));
  await seed('organizationSessions/org-host', { ownerUid: 'host', roomId: 'DEPART', tournamentId: 'major1' });
  const hostLeaves = { hostId: 'guest', 'players.host.left': true, 'players.host.isReady': false, 'players.host.isHost': false, 'players.guest.isHost': true, 'tournament.abandonedUids': ['host'] };
  await check('outsider cannot evict live member', false, () => depart(outsider, 'DEPART', 'host', hostLeaves, 'timeout', true, true));
  await check('host cannot cancel while another player remains', false, () => depart(host, 'DEPART', 'host', { ...hostLeaves, status: 'closed', closedReason: 'empty', 'tournament.stage': 'cancelled' }, 'navigation', true, true));
  await check('host Major departure transfers host and releases lock', true, () => depart(host, 'DEPART', 'host', hostLeaves, 'navigation', true, true));
  await check('departure claim released', true, async () => assert.equal((await getDoc(doc(host, 'roomSessions/host'))).exists(), false));
  await check('departure organization lock released', true, async () => assert.equal((await getDoc(doc(host, 'organizationSessions/org-host'))).exists(), false));
  await check('abandonment is immutable', false, () => updateDoc(doc(host, 'users/host/abandonments/major1'), { reason: 'reload' }));
  await seed('rooms/DUPL', playing('DUPL'));
  await check('one abandonment per Major', false, () => depart(host, 'DUPL', 'host', hostLeaves));
  await seed('rooms/EXPIRE', playing('EXPIRE'));
  await seed('roomSessions/guest', session('guest', 'EXPIRE', new Date(Date.now() - 181000)));
  const guestLeaves = { 'players.guest.left': true, 'players.guest.isReady': false, 'players.guest.isHost': false, 'tournament.abandonedUids': ['guest'] };
  await check('expired member can be reconciled', true, () => depart(host, 'EXPIRE', 'guest', guestLeaves, 'timeout'));
  await seed('rooms/LEAVE', { ...playing('LEAVE'), tournament: { ...tournament, tournamentId: 'leavemajor' } });
  await check('member marks session leaving', true, () => updateDoc(doc(guest, 'roomSessions/guest'), { heartbeat: serverTimestamp(), leaving: true }));
  await check('leaving member can be reconciled', true, () => depart(host, 'LEAVE', 'guest', guestLeaves, 'closed', true, false, 'leavemajor'));
  await seed('rooms/EMPTY', { ...playing('EMPTY'), players: { guest: { ...guestMember, isHost: true } }, hostId: 'guest', tournament: { ...tournament, tournamentId: 'lastmajor', participantUids: ['guest'], abandonedUids: [] } });
  await check('last participant closes without a champion', true, () => depart(guest, 'EMPTY', 'guest', { status: 'closed', closedReason: 'empty', 'players.guest.left': true, 'players.guest.isReady': false, 'players.guest.isHost': false, 'tournament.stage': 'cancelled', 'tournament.abandonedUids': ['guest'] }, 'closed', true, false, 'lastmajor'));
  await check('closed room has no champion', true, async () => { const t = (await getDoc(doc(guest, 'rooms/EMPTY'))).data().tournament; assert.equal(t.stage, 'cancelled'); assert.equal(t.winner, undefined); });
  await seed('rooms/WON', { ...playing('WON'), tournament: { ...tournament, tournamentId: 'wonmajor', stage: 'won' } });
  await check('no abandonment after won', false, () => depart(host, 'WON', 'host', { hostId: 'guest', 'players.host.left': true, 'players.host.isHost': false, 'players.guest.isHost': true }, 'navigation', true, false, 'wonmajor'));
  await check('departure after won needs no abandonment', true, () => depart(host, 'WON', 'host', { hostId: 'guest', 'players.host.left': true, 'players.host.isHost': false, 'players.guest.isHost': true }, 'navigation', false));
  await seed('rooms/FINAL', { ...playing('FINAL'), players: { guest: { ...guestMember, isHost: true } }, hostId: 'guest', tournament: { ...tournament, stage: 'won', winner: 'a' } });
  await check('last departure preserves finished winner', true, () => depart(guest, 'FINAL', 'guest', { status: 'closed', closedReason: 'empty', 'players.guest.left': true, 'players.guest.isHost': false }, 'closed', false));
  await check('finished winner remains recorded', true, async () => { const t = (await getDoc(doc(guest, 'rooms/FINAL'))).data().tournament; assert.equal(t.stage, 'won'); assert.equal(t.winner, 'a'); });
  await seed('rooms/WATCH', { ...playing('WATCH'), players: { host: hostMember, guest: guestMember, outsider: { ...member('outsider'), participating: false } } });
  await check('spectator cannot record abandonment', false, () => depart(outsider, 'WATCH', 'outsider', { 'players.outsider.left': true }, 'navigation'));
  await check('spectator leaves without abandonment', true, () => depart(outsider, 'WATCH', 'outsider', { 'players.outsider.left': true }, 'navigation', false));
  await seed('rooms/STARTMATCH', { ...playing('STARTMATCH'), tournament: { ...tournament, matchesStarted: false } });
  await check('guest cannot start matches', false, () => updateDoc(doc(guest, 'rooms/STARTMATCH'), { 'tournament.matchesStarted': true }));
  await check('host starts matches', true, () => updateDoc(doc(host, 'rooms/STARTMATCH'), { 'tournament.matchesStarted': true }));
  await check('outsider lock creation', false, () => setDoc(doc(outsider, 'organizationSessions/org-host'), { ownerUid: 'host', roomId: 'PLAYING', tournamentId: 'major1' }));
  await check('lock collection listing denied', false, () => getDocs(collection(host, 'organizationSessions')));
  const readyMembers = Object.fromEntries(Array.from({ length: 8 }, (_, i) => {
    const uid = i === 0 ? 'host' : `player${i}`;
    return [uid, { ...member(uid, i === 0), isReady: true }];
  }));
  await seed('rooms/LOCK', { ...lobby('LOCK'), players: readyMembers });
  const startTournament = { ...tournament, simulation: {engineVersion:2,playerDataVersion:'players-v2.0.0',bankVersion:'mirage-economy-v1'}, matchesStarted: false, participantUids: Object.keys(readyMembers) };
  await check('host atomic start with eight locks', true, async () => {
    const batch = writeBatch(host);
    for (const [uid, player] of Object.entries(readyMembers)) batch.set(doc(host, `organizationSessions/${player.organization.id}`), { ownerUid: uid, roomId: 'LOCK', tournamentId: 'major1' });
    batch.update(doc(host, 'rooms/LOCK'), { status: 'playing', generation: 1, tournament: startTournament });
    await batch.commit();
  });
  await check('lock deletion without return', false, () => deleteDoc(doc(host, 'organizationSessions/org-host')));
  await check('authenticated lock lookup', true, () => getDoc(doc(guest, 'organizationSessions/org-host')));
  await check('guest cannot return', false, () => updateDoc(doc(guest, 'rooms/LOCK'), { status: 'lobby' }));
  await seed('rooms/LOCK', { ...lobby('LOCK'), status: 'playing', generation: 1, players: readyMembers, tournament: { ...startTournament, stage: 'won' } });
  await seed('rooms/LOCK/results/major1~match1', submission);
  await check('result deletion without return', false, () => deleteDoc(doc(host, 'rooms/LOCK/results/major1~match1')));
  await check('guest result deletion', false, () => deleteDoc(doc(guest, 'rooms/LOCK/results/major1~match1')));
  await check('host atomic return releases locks', true, async () => {
    const batch = writeBatch(host);
    for (const player of Object.values(readyMembers)) batch.delete(doc(host, `organizationSessions/${player.organization.id}`));
    batch.delete(doc(host, 'rooms/LOCK/results/major1~match1'));
    const reset = Object.fromEntries(Object.entries(readyMembers).map(([uid, player]) => [uid, { ...player, isReady: false }]));
    batch.update(doc(host, 'rooms/LOCK'), { status: 'lobby', players: reset, lastMajor: { tournamentId: 'major1', winner: 'a' } });
    await batch.commit();
  });
  await seed('rooms/RETURNBAD', { ...playing('RETURNBAD'), tournament: { ...tournament, stage: 'won' } });
  for (const uid of ['host', 'guest']) await seed(`organizationSessions/org-${uid}`, { ownerUid: uid, roomId: 'RETURNBAD', tournamentId: 'major1' });
  await check('return cannot leave organization locks behind', false, () => updateDoc(doc(host, 'rooms/RETURNBAD'), { status: 'lobby', lastMajor: { tournamentId: 'major1', winner: 'a' } }));
  await seed('roomSessions/host', session('host', 'PLAYING', new Date()));
  await seed('roomSessions/guest', session('guest', 'PLAYING', new Date()));
  for (const [map, allowed] of [['de_other', false], ['de_dust2', true]]) {
    await check(`result map ${map}`, allowed, () => setDoc(doc(host, 'rooms/PLAYING/results/major1~match1'), { ...submission, result: { ...result, maps: [{ ...result.maps[0], map }] } }));
  }
  const resetResult = await fetch(`${documents}/rooms/PLAYING/results/major1~match1`, { method: 'DELETE', headers: { Authorization: 'Bearer owner' } });
  assert.ok(resetResult.ok);
  await check('valid result', true, () => setDoc(doc(host, 'rooms/PLAYING/results/major1~match1'), submission));
  await check('member reads result', true, () => getDoc(doc(guest, 'rooms/PLAYING/results/major1~match1')));
  await check('outsider cannot read result', false, () => getDoc(doc(outsider, 'rooms/PLAYING/results/major1~match1')));
  await check('immutable result', false, () => setDoc(doc(host, 'rooms/PLAYING/results/major1~match1'), submission));
  for (const [name, ratings, allowed] of [
    ['valid ratings including bounds', [0, 10, 1.25, 1, 1, 1, 1, 1, 1, 1], true],
    ['short ratings', Array(9).fill(1), false],
    ['long ratings', Array(11).fill(1), false],
    ['ratings must be a list', '1,1,1,1,1,1,1,1,1,1', false],
    ['non-numeric rating', ['1', ...Array(9).fill(1)], false],
    ['boolean rating', [true, ...Array(9).fill(1)], false],
    ['null rating', [null, ...Array(9).fill(1)], false],
    ['negative rating', [-0.01, ...Array(9).fill(1)], false],
    ['out-of-range rating', [10.01, ...Array(9).fill(1)], false],
    ['NaN rating', [NaN, ...Array(9).fill(1)], false],
    ['infinite rating', [Infinity, ...Array(9).fill(1)], false],
  ]) {
    await seed('rooms/RATINGS', playing('RATINGS'));
    const response = await fetch(`${documents}/rooms/RATINGS/results/major1~match1`, { method: 'DELETE', headers: { Authorization: 'Bearer owner' } });
    assert.ok(response.ok || response.status === 404, 'rating fixture reset');
    await check(name, allowed, () => setDoc(doc(host, 'rooms/RATINGS/results/major1~match1'), { ...submission, result: { ...result, playerRatings: ratings } }));
  }
  await check('host cannot change tournament ID', false, () => updateDoc(doc(host, 'rooms/PLAYING'), { 'tournament.tournamentId': 'other' }));
  await seed('rooms/RACE', playing('RACE'));
  await check('concurrent result creates exactly one winner', true, async () => {
    const attempts = await Promise.allSettled([
      setDoc(doc(host, 'rooms/RACE/results/major1~match1'), submission),
      setDoc(doc(guest, 'rooms/RACE/results/major1~match1'), { ...submission, submittedBy: 'guest' }),
    ]);
    assert.equal(attempts.filter(a => a.status === 'fulfilled').length, 1);
    assert.equal(attempts.filter(a => a.status === 'rejected' && a.reason.code === 'permission-denied').length, 1);
  });
  await seed('rooms/NOTSTARTED', { ...playing('NOTSTARTED'), tournament: { ...tournament, matchesStarted: false } });
  await check('result before matches start', false, () => setDoc(doc(host, 'rooms/NOTSTARTED/results/major1~match1'), submission));
  await seed('rooms/FINISHED', { ...playing('FINISHED'), tournament: { ...tournament, stage: 'won' } });
  await check('result after Major finished', false, () => setDoc(doc(host, 'rooms/FINISHED/results/major1~match1'), submission));
  await seed('rooms/SPECTATE', { ...playing('SPECTATE'), players: { host: hostMember, guest: guestMember, outsider: { ...member('outsider'), participating: false } } });
  await check('spectator result', false, () => setDoc(doc(outsider, 'rooms/SPECTATE/results/major1~match1'), { ...submission, submittedBy: 'outsider' }));
  await seed('rooms/OTHER', { ...playing('OTHER'), tournament: { ...tournament, matches: [{ ...match, playerUids: ['guest'] }] } });
  await check('participant in another match', false, () => setDoc(doc(host, 'rooms/OTHER/results/major1~match1'), submission));
  for (const [round, scores] of [['Quarterfinals', [2, 0]], ['Final', [3, 0]]]) {
    const id = round === 'Final' ? 'BO5' : 'BO3';
    await seed(`rooms/${id}`, { ...playing(id), tournament: { ...tournament, matches: [{ ...match, round }] } });
    const series = { ...submission, result: { ...result, playerRatings: Array(10).fill(1.2), scoreA: scores[0], scoreB: scores[1], maps: Array(scores[0]).fill(result.maps[0]) } };
    await check(`${id} valid series`, true, () => setDoc(doc(host, `rooms/${id}/results/major1~match1`), series));
    await seed(`rooms/${id}BAD`, { ...playing(`${id}BAD`), tournament: { ...tournament, matches: [{ ...match, round }] } });
    await check(`${id} inconsistent series`, false, () => setDoc(doc(host, `rooms/${id}BAD/results/major1~match1`), { ...series, result: { ...series.result, scoreA: 1 } }));
  }
  for (const [round, winners] of [['Quarterfinals', ['a', 'b', 'a']], ['Quarterfinals', ['b', 'a', 'b']], ['Final', ['a', 'b', 'a', 'b', 'a']], ['Final', ['b', 'a', 'b', 'a', 'b']], ['Final', ['a', 'a', 'b', 'a']], ['Final', ['b', 'b', 'a', 'b']]]) {
    const id = `LONG${round}${winners.length}${winners.at(-1)}`;
    await seed(`rooms/${id}`, { ...playing(id), tournament: { ...tournament, matches: [{ ...match, round }] } });
    const maps = winners.map(winnerId => ({ map: 'de_mirage', scoreA: winnerId === 'a' ? 13 : 7, scoreB: winnerId === 'b' ? 13 : 7, winnerId }));
    const scoreA = winners.filter(winner => winner === 'a').length;
    const series = { ...submission, result: { ...result, playerRatings: Array(10).fill(1.2), scoreA, scoreB: winners.length - scoreA, winner: winners.at(-1), maps } };
    await check(`${id} full-length series with ratings`, true, () => setDoc(doc(host, `rooms/${id}/results/major1~match1`), series));
    const realMatch = { ...match, round, teamA: { ...teams[0], id: 'a' }, teamB: { ...teams[1], id: 'b' } };
    await seed(`rooms/${id}REAL`, { ...playing(`${id}REAL`), tournament: { ...tournament, matches: [realMatch] } });
    await check(`${id} real teams with ratings`, true, () => setDoc(doc(host, `rooms/${id}REAL/results/major1~match1`), { ...series, result: { ...series.result, teamA: realMatch.teamA, teamB: realMatch.teamB } }));
    const lastMap = maps.at(-1);
    for (const field of ['map', 'scoreA', 'scoreB', 'winnerId', 'extra']) {
      const invalid = { ...lastMap, extra: true };
      if (field !== 'extra') { delete invalid.extra; delete invalid[field]; }
      await seed(`rooms/${id}BADMAP`, { ...playing(`${id}BADMAP`), tournament: { ...tournament, matches: [{ ...match, round }] } });
      await check(`${id} rejects map ${field}`, false, () => setDoc(doc(host, `rooms/${id}BADMAP/results/major1~match1`), { ...series, result: { ...series.result, maps: [...maps.slice(0, -1), invalid] } }));
    }
  }
  for (const [name, db, changes] of [
    ['outsider result', outsider, { submittedBy: 'outsider' }],
    ['other match', host, { matchId: 'other' }],
    ['cross major', host, { tournamentId: 'old' }],
    ['invalid winner', host, { result: { ...result, winner: 'b' } }],
    ['invalid score', host, { result: { ...result, scoreA: -1 } }],
    ['invalid map', host, { result: { ...result, maps: [{ ...result.maps[0], winnerId: 'b' }] } }],
    ['missing maps', host, { result: { ...result, maps: [] } }],
  ]) {
    await seed('rooms/RESULT', playing('RESULT'));
    const candidate = { ...submission, ...changes };
    await check(name, false, () => setDoc(doc(db, `rooms/RESULT/results/${candidate.tournamentId}~${candidate.matchId}`), candidate));
  }
  await seed('rooms/CHAT', lobby('CHAT'));
  const signal = db => doc(db, 'rooms/CHAT/chatSignals/guest');
  const offer = () => ({ guestUid: 'guest', hostUid: 'host', guestPageId: 'page-guest', connectionId: 'connection', offer: 'sdp', createdAt: serverTimestamp() });
  await check('guest creates chat offer', true, () => setDoc(signal(guest), offer()));
  await check('host reads chat offer', true, () => getDoc(signal(host)));
  await check('guest reads own chat offer', true, () => getDoc(signal(guest)));
  await check('outsider cannot read chat offer', false, () => getDoc(signal(outsider)));
  await check('anonymous cannot read chat offer', false, () => getDoc(signal(anonymous)));
  await check('host lists chat offers with limit', true, () => getDocs(query(collection(host, 'rooms/CHAT/chatSignals'), limit(8))));
  await check('host cannot list without limit', false, () => getDocs(collection(host, 'rooms/CHAT/chatSignals')));
  await check('host cannot list above limit', false, () => getDocs(query(collection(host, 'rooms/CHAT/chatSignals'), limit(9))));
  await check('guest cannot list chat offers', false, () => getDocs(query(collection(guest, 'rooms/CHAT/chatSignals'), limit(8))));
  await check('guest cannot answer offer', false, () => updateDoc(signal(guest), { answer: 'sdp', hostPageId: 'page-host' }));
  await check('host cannot modify offer', false, () => updateDoc(signal(host), { offer: 'changed', answer: 'sdp', hostPageId: 'page-host' }));
  await check('host cannot answer from stale page', false, () => updateDoc(signal(host), { answer: 'sdp', hostPageId: 'stale' }));
  await check('host cannot answer with oversized SDP', false, () => updateDoc(signal(host), { answer: 'x'.repeat(32001), hostPageId: 'page-host' }));
  await check('host answers chat offer', true, () => updateDoc(signal(host), { answer: 'sdp', hostPageId: 'page-host' }));
  await check('host cannot replace answer', false, () => updateDoc(signal(host), { answer: 'changed' }));
  await check('guest replaces answered offer', true, () => setDoc(signal(guest), { ...offer(), connectionId: 'next' }));
  for (const [name, changes] of [
    ['extra field', { extra: true }], ['answer', { answer: 'sdp' }], ['host page', { hostPageId: 'page-host' }],
    ['wrong guest', { guestUid: 'host' }], ['wrong host', { hostUid: 'guest' }], ['stale guest page', { guestPageId: 'stale' }],
    ['empty connection', { connectionId: '' }], ['long connection', { connectionId: 'x'.repeat(101) }],
    ['non-string SDP', { offer: 1 }], ['empty SDP', { offer: '' }], ['oversized SDP', { offer: 'x'.repeat(32001) }],
    ['client timestamp', { createdAt: new Date() }],
  ]) await check(`chat rejects ${name}`, false, () => setDoc(signal(guest), { ...offer(), ...changes }));
  await check('outsider cannot write chat offer', false, () => setDoc(signal(outsider), offer()));
  await check('anonymous cannot write chat offer', false, () => setDoc(signal(anonymous), offer()));
  await seed('roomSessions/guest', { ...session('guest', 'CHAT', new Date()), pageId: 'stale' });
  await check('stale guest session cannot write', false, () => setDoc(signal(guest), offer()));
  await check('host cannot answer stale guest session', false, () => updateDoc(signal(host), { answer: 'sdp', hostPageId: 'page-host' }));
  await seed('roomSessions/guest', session('guest', 'CHAT', new Date()));
  await seed('roomSessions/host', { ...session('host', 'CHAT', new Date()), pageId: 'stale' });
  await check('stale host session cannot answer', false, () => updateDoc(signal(host), { answer: 'sdp', hostPageId: 'page-host' }));
  await check('guest cannot offer to stale host', false, () => setDoc(signal(guest), offer()));
  await seed('roomSessions/host', session('host', 'CHAT', new Date()));
  await check('outsider cannot delete chat offer', false, () => deleteDoc(signal(outsider)));
  await check('host deletes chat offer', true, () => deleteDoc(signal(host)));
  await check('guest recreates chat offer', true, () => setDoc(signal(guest), offer()));
  await check('guest deletes chat offer', true, () => deleteDoc(signal(guest)));
  await seed('rooms/CHAT', { ...lobby('CHAT'), status: 'closed' });
  await check('closed room rejects chat offer', false, () => setDoc(signal(guest), offer()));
  await check('closed room rejects chat list', false, () => getDocs(query(collection(host, 'rooms/CHAT/chatSignals'), limit(8))));

} finally {
  for (const { app, db } of clients) { await terminate(db); await deleteApp(app); }
  const response = await fetch(`${origin}/emulator/v1/projects/${project}/databases/(default)/documents`, { method: 'DELETE', signal: AbortSignal.timeout(10000) });
  assert.ok(response.ok, 'the isolated test namespace was cleaned');
}
console.log(`Firestore security: ${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;

