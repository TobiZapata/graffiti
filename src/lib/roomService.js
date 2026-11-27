import catalog from '../data/teams.json';
import { upgradeOrganization } from './upgradeOrganization.mjs';
import { auth, db } from './firebase';
import { collection, doc, FieldPath, getDoc, getDocFromServer, getDocs, limit, query, runTransaction, serverTimestamp, updateDoc, where, writeBatch } from 'firebase/firestore';
import { completedFinal, initializeSingleMatch, lobby, member, readyPlayers } from './roomLifecycle.mjs';
import { decodeRoom, encodeMatch, encodeMember, encodePlayers, encodeTournament, PLAYBACK_SPEEDS, roomCapacity, SINGLE_MATCH_BEST_OF } from './roomStorage.mjs';
import { compactMatchResult, validMatchResult } from './multiplayerResults.mjs';
import { recordLocalAbandonment } from './localAbandonments.mjs';
import { applyForfeits } from './roomForfeit.mjs';
import { clearRoomSession, getPageSession, readRoomSession, rememberRoomSession, roomDeparture, roomSessionExpired } from './roomSession.mjs';
import { initializeMultiplayerTournament } from './tournamentService';

const roomRef = code => doc(db, 'rooms', code.toUpperCase());
const lockRef = id => doc(db, 'organizationSessions', id);
const sessionRef = uid => doc(db, 'roomSessions', uid);
const authenticate = uid => { if (!uid || auth.currentUser?.uid !== uid) throw new Error('You need to be signed in.'); };
const host = (room, uid) => { if (room.hostId !== uid) throw new Error('Only the host can do this.'); };
const readRoom = async (tx, ref) => {
  const snap = await tx.get(ref);
  if (!snap.exists()) throw new Error('Room not found.');
  if (snap.data().schemaVersion !== 3) throw new Error('This older room is read-only. Create a new room to play.');
  return decodeRoom(snap.data());
};
const ownPage = (room, uid) => {
  if (!room.players.some(p => p.uid === uid && !p.left && p.sessionId === getPageSession().pageId)) throw new Error('This room is not active in this tab.');
};
let pageToken = null;
async function cachePageToken(uid) {
  authenticate(uid);
  pageToken = { uid, value: await auth.currentUser.getIdToken() };
}
const sessionData = (uid, roomId, identity) => ({ uid, roomId, ...identity, heartbeat: serverTimestamp(), leaving: false });
const newMember = (uid, name, org, isHost) => ({ ...member(uid, name, upgradeOrganization(org, catalog), isHost), sessionId: getPageSession().pageId, left: false });
const matchingLock = (snap, room, uid) => snap.exists() && snap.data().roomId === room.id && snap.data().tournamentId === room.tournament?.tournamentId && snap.data().ownerUid === uid;

async function availableSession(tx, uid) {
  if ((await tx.get(sessionRef(uid))).exists()) throw new Error('You already have an active room. Leave it in the original tab before joining another.');
}

export async function createRoom(uid, name, organization, visibility = 'public', playbackMode = 'highlights', roomName = '', playbackSpeed = 1, { roomFormat = 'major', bestOf = 1 } = {}) {
  authenticate(uid);
  const title = roomName?.trim() || `${organization.name}'s Room`.slice(0, 35);
  if (title.length > 35) throw new Error('Room names must be at most 35 characters.');
  if (!['public', 'private'].includes(visibility)) throw new Error('Invalid room visibility.');
  if (!['full', 'highlights'].includes(playbackMode)) throw new Error('Invalid playback mode.');
  if (!PLAYBACK_SPEEDS.includes(playbackSpeed)) throw new Error('Invalid playback speed.');
  if (!['major', 'singleMatch'].includes(roomFormat) || (roomFormat === 'singleMatch' && !SINGLE_MATCH_BEST_OF.includes(bestOf))) throw new Error('Invalid room format.');
  const identity = getPageSession(), player = newMember(uid, name, organization, true);
  await cachePageToken(uid);
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = Array.from({ length: 4 }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 36)]).join('');
    const ref = roomRef(code);
    const created = await runTransaction(db, async tx => {
      await availableSession(tx, uid);
      if ((await tx.get(ref)).exists()) return false;
      tx.set(ref, { id: code, name: title, hostId: uid, status: 'lobby', visibility, playbackMode, playbackSpeed,
        ...(roomFormat === 'singleMatch' ? { roomFormat, bestOf } : {}),
        players: encodePlayers([player]), schemaVersion: 3, generation: 0, createdAt: new Date().toISOString() });
      tx.set(sessionRef(uid), sessionData(uid, code, identity));
      return true;
    });
    if (created) { rememberRoomSession({ roomId: code, ...identity }); return code; }
  }
  throw new Error('The room could not be created.');
}

export async function joinRoom(code, uid, name, organization) {
  authenticate(uid);
  const ref = roomRef(code), identity = getPageSession();
  await cachePageToken(uid);
  await runTransaction(db, async tx => {
    await availableSession(tx, uid);
    const room = await readRoom(tx, ref);
    lobby(room);
    if (room.players.length >= roomCapacity(room)) throw new Error('This room is full.');
    const player = newMember(uid, name, organization, false);
    tx.update(ref, new FieldPath('players', uid), encodeMember(player));
    tx.set(sessionRef(uid), sessionData(uid, room.id, identity));
  });
  rememberRoomSession({ roomId: ref.id, ...identity });
  return ref.id;
}

export async function setRoomPlaybackSpeed(code, uid, playbackSpeed) {
  authenticate(uid);
  if (!PLAYBACK_SPEEDS.includes(playbackSpeed)) throw new Error('Invalid playback speed.');
  const ref = roomRef(code);
  await runTransaction(db, async tx => {
    const room = await readRoom(tx, ref);
    lobby(room); host(room, uid); ownPage(room, uid);
    tx.update(ref, { playbackSpeed });
  });
}

export async function setRoomBestOf(code, uid, bestOf) {
  authenticate(uid);
  if (!SINGLE_MATCH_BEST_OF.includes(bestOf)) throw new Error('Invalid best-of format.');
  const ref = roomRef(code);
  await runTransaction(db, async tx => {
    const room = await readRoom(tx, ref);
    lobby(room); host(room, uid); ownPage(room, uid);
    if (room.roomFormat !== 'singleMatch') throw new Error('This is a Major lobby.');
    tx.update(ref, { bestOf });
  });
}

export async function setRoomReady(code, uid, organization, ready) {
  authenticate(uid);
  if (typeof ready !== 'boolean') throw new Error('Invalid state.');
  const updated = member(uid, '', upgradeOrganization(organization, catalog)), ref = roomRef(code);
  await runTransaction(db, async tx => {
    const room = await readRoom(tx, ref);
    lobby(room); ownPage(room, uid);
    const player = room.players.find(p => p.uid === uid);
    tx.update(ref, new FieldPath('players', uid), encodeMember({ ...player, organization: updated.organization, participating: true, isReady: ready }));
  });
}

export async function kickRoomMember(code, uid, targetUid) {
  authenticate(uid);
  const ref = roomRef(code);
  await runTransaction(db, async tx => {
    const room = await readRoom(tx, ref);
    lobby(room); host(room, uid); ownPage(room, uid);
    if (targetUid === uid) throw new Error('Use Leave room to leave your own lobby.');
    const departure = roomDeparture(room, targetUid, 'kicked');
    if (!departure) throw new Error('This player is no longer in the lobby.');
    const session = await tx.get(sessionRef(targetUid));
    if (!session.exists() || session.data().uid !== targetUid || session.data().roomId !== room.id || session.data().pageId !== departure.target.sessionId) throw new Error('This player’s room session has changed. Refresh the lobby.');
    tx.delete(session.ref);
    tx.update(ref, { ...departure.change, players: encodePlayers(departure.change.players) });
  });
}

export async function startRoomMajor(code, uid) {
  authenticate(uid);
  await reconcileRoomSessions(code);
  const ref = roomRef(code), tournamentId = crypto.randomUUID();
  await runTransaction(db, async tx => {
    const room = await readRoom(tx, ref);
    host(room, uid); ownPage(room, uid);
    const players = readyPlayers(room);
    const locks = await Promise.all(players.map(p => tx.get(lockRef(p.organization.id))));
    if (locks.some(s => s.exists())) throw new Error('One of these organizations is already playing another Major.');
    const single = room.roomFormat === 'singleMatch';
    const tournament = single ? initializeSingleMatch(players, room.bestOf) : await initializeMultiplayerTournament(players);
    players.forEach(p => tx.set(lockRef(p.organization.id), { ownerUid: p.uid, roomId: room.id, tournamentId }));
    tx.update(ref, { status: 'playing', generation: (room.generation || 0) + 1, tournament: encodeTournament({ ...tournament, tournamentId, participantUids: players.map(p => p.uid), abandonedUids: [], matchesStarted: single }) });
  });
}

export async function completeRoomSingleMatch(code, uid, tournamentId, result) {
  authenticate(uid);
  const ref = roomRef(code);
  return runTransaction(db, async tx => {
    const room = await readRoom(tx, ref), tournament = room.tournament;
    ownPage(room, uid);
    if (room.roomFormat !== 'singleMatch' || tournament?.tournamentId !== tournamentId || !tournament.participantUids.includes(uid)) throw new Error('This match is no longer active.');
    const [match] = tournament.matches;
    if (match.completed) return match.result;
    if (room.status !== 'playing' || tournament.stage !== 'single_match') throw new Error('This match is no longer active.');
    const forfeited = tournament.abandonedUids.length > 0;
    if (!forfeited && !validMatchResult(match, result)) throw new Error('Invalid match result.');
    const completed = forfeited ? applyForfeits(tournament).matches[0] : { ...match, completed: true, result: compactMatchResult(match, result) };
    tx.update(ref, { 'tournament.stage': 'won', 'tournament.matches': [encodeMatch(completed)] });
    return { ...(forfeited ? completed.result : result), teamA: match.teamA, teamB: match.teamB };
  });
}

export async function returnRoomToLobby(code, uid, finishedId) {
  authenticate(uid);
  const ref = roomRef(code), results = await getDocs(collection(ref, 'results'));
  await runTransaction(db, async tx => {
    const room = await readRoom(tx, ref);
    ownPage(room, uid);
    if (room.roomFormat === 'singleMatch') {
      if (room.status === 'lobby' || (finishedId && room.tournament?.tournamentId !== finishedId)) return;
      if (!room.tournament.participantUids.includes(uid)) throw new Error('You are not in this match.');
    } else host(room, uid);
    const final = completedFinal(room);
    const participants = room.players.filter(p => room.tournament.participantUids.includes(p.uid));
    const locks = await Promise.all(participants.map(p => tx.get(lockRef(p.organization.id))));
    results.docs.filter(s => s.data().tournamentId === room.tournament.tournamentId).forEach(s => tx.delete(s.ref));
    locks.forEach((s, i) => { if (matchingLock(s, room, participants[i].uid)) tx.delete(s.ref); });
    tx.update(ref, { status: 'lobby', players: encodePlayers(room.players.filter(p => !p.left).map(p => ({ ...p, participating: true, isReady: false }))), lastMajor: { tournamentId: room.tournament.tournamentId, winner: final.result.winner } });
  });
}

async function departRoom(code, uid, reason, expectedPageId) {
  const ref = roomRef(code);
  // Stage can finish while departure is queued; closure cleanup is only needed for a closing room.
  const before = await getDoc(ref);
  const old = before.exists() ? decodeRoom(before.data()) : null;
  const preview = old?.schemaVersion === 3 ? roomDeparture(old, uid, reason) : null;
  const results = preview?.closed ? await getDocs(collection(ref, 'results')) : null;
  const abandonment = await runTransaction(db, async tx => {
    const snap = await tx.get(ref), session = await tx.get(sessionRef(uid));
    if (session.exists() && (session.data().roomId !== ref.id || expectedPageId && session.data().pageId !== expectedPageId)) return;
    if (!snap.exists()) { if (session.exists()) tx.delete(session.ref); return; }
    const room = decodeRoom(snap.data());
    if (room.schemaVersion !== 3) return;
    const departure = roomDeparture(room, uid, reason);
    if (!departure) { if (session.exists()) tx.delete(session.ref); return; }
    const lock = room.status === 'playing' && departure.target.participating ? await tx.get(lockRef(departure.target.organization.id)) : null;
    const closeSessions = departure.closed ? await Promise.all(room.players.filter(p => p.uid !== uid).map(p => tx.get(sessionRef(p.uid)))) : [];
    if (departure.closed && !preview?.closed) throw new Error('The room changed while closing. Try leaving again.');
    if (lock && matchingLock(lock, room, uid)) tx.delete(lock.ref);
    if (session.exists()) tx.delete(session.ref);
    closeSessions.forEach(s => { if (s.exists() && s.data().roomId === ref.id) tx.delete(s.ref); });
    results?.docs.forEach(s => tx.delete(s.ref));
    const { tournament, ...change } = departure.change;
    tx.update(ref, { ...change, players: encodePlayers(change.players), ...(tournament && {
      'tournament.abandonedUids': tournament.abandonedUids,
      'tournament.stage': tournament.stage,
    }) });
    if (departure.forfeit && room.roomFormat !== 'singleMatch') {
      return { organizationId: departure.target.organization.id, roomId: room.id,
        tournamentId: room.tournament.tournamentId, reason };
    }
  });
  if (abandonment && auth.currentUser?.uid === uid) {
    recordLocalAbandonment(typeof window !== 'undefined' ? window.localStorage : null, abandonment);
  }
  // A result can commit before closure but after the first query; closed rooms reject new submissions.
  const closed = await getDoc(ref);
  if (closed.exists() && closed.data().status === 'closed') {
    const remaining = await getDocs(collection(ref, 'results'));
    if (!remaining.empty) {
      const batch = writeBatch(db);
      remaining.docs.forEach(s => batch.delete(s.ref));
      await batch.commit();
    }
  }
}

export async function leaveRoom(code, uid, reason = 'navigation', expectedPageId) {
  authenticate(uid);
  if (!['navigation', 'reload', 'closed', 'timeout'].includes(reason)) throw new Error('Invalid departure reason.');
  const expected = expectedPageId || getPageSession().pageId;
  await departRoom(code, uid, reason, expected);
  const stored = readRoomSession();
  if (stored?.roomId === code.toUpperCase() && stored.pageId === expected) clearRoomSession();
}

export async function heartbeatRoomSession(uid, pageId) {
  authenticate(uid);
  if (getPageSession().pageId !== pageId) throw new Error('This room is active in another tab.');
  await updateDoc(sessionRef(uid), { heartbeat: serverTimestamp(), leaving: false });
  await cachePageToken(uid);
}

export function markRoomSessionLeaving(uid, pageId) {
  if (pageToken?.uid !== uid) return;
  const project = db.app.options.projectId;
  const origin = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true' ? 'http://127.0.0.1:8088' : 'https://firestore.googleapis.com';
  const name = `projects/${project}/databases/(default)/documents/roomSessions/${uid}`;
  // shortcut: pagehide is best effort; reload detection and the server lease handle lost requests.
  fetch(`${origin}/v1/projects/${project}/databases/(default)/documents:commit`, {
    method: 'POST', keepalive: true, headers: { Authorization: `Bearer ${pageToken.value}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ writes: [{ update: { name, fields: { pageId: { stringValue: pageId }, leaving: { booleanValue: true } } },
      updateMask: { fieldPaths: ['pageId', 'leaving'] }, updateTransforms: [{ fieldPath: 'heartbeat', setToServerValue: 'REQUEST_TIME' }], currentDocument: { exists: true } }] }),
  }).catch(() => {});
}

export async function reconcileRoomSessions(code) {
  if (!auth.currentUser) return;
  const snap = await getDoc(roomRef(code));
  if (!snap.exists() || snap.data().schemaVersion !== 3) return;
  const room = decodeRoom(snap.data());
  const sessions = await Promise.all(room.players.filter(p => !p.left).map(async p => ({ uid: p.uid, snap: await getDocFromServer(sessionRef(p.uid)) })));
  for (const { uid, snap: session } of sessions) {
    if (session.exists() && (room.status === 'closed' || roomSessionExpired(session.data()))) {
      await departRoom(code, uid, session.data().leaving ? 'closed' : 'timeout', session.data().pageId);
    }
  }
}

export async function listPublicRooms() {
  const rooms = await getDocs(query(collection(db, 'rooms'), where('visibility', '==', 'public'), where('status', '==', 'lobby'), limit(50)));
  const current = rooms.docs.filter(s => s.data().schemaVersion === 3);
  await Promise.all(current.map(async s => {
    try { await reconcileRoomSessions(s.id); }
    catch (error) { if (error.code !== 'permission-denied') throw error; }
  }));
  const fresh = await Promise.all(current.map(s => getDoc(s.ref)));
  return fresh.filter(s => s.exists() && s.data().status === 'lobby').map(s => decodeRoom(s.data()));
}
