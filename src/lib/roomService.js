import { auth, db } from './firebase';
import { collection, doc, getDocs, limit, query, runTransaction, where } from 'firebase/firestore';
import { assertCanReady, completedFinal, lobby, member, participation, readyPlayers } from './roomLifecycle.mjs';
import { initializeMultiplayerTournament } from './tournamentService';

const roomRef = code => doc(db, 'rooms', code.toUpperCase());
const lockRef = id => doc(db, 'organizationSessions', id);
const authenticate = uid => { if (!uid || auth.currentUser?.uid !== uid) throw new Error('Debes iniciar sesión.'); };
const host = (room, uid) => { if (room.hostId !== uid) throw new Error('Solo el anfitrión puede hacer esto.'); };
const readRoom = async (tx, ref) => {
  const snap = await tx.get(ref);
  if (!snap.exists()) throw new Error('Sala no encontrada.');
  return snap.data();
};

export async function createRoom(uid, name, organization, visibility = 'public') {
  authenticate(uid);
  if (!['public', 'private'].includes(visibility)) throw new Error('Visibilidad inválida.');
  const player = member(uid, name, organization, true);
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = Array.from({ length: 4 }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 36)]).join('');
    const ref = roomRef(code);
    const created = await runTransaction(db, async tx => {
      if ((await tx.get(ref)).exists()) return false;
      tx.set(ref, { id: code, hostId: uid, status: 'lobby', visibility, players: [player], generation: 0, createdAt: new Date().toISOString() });
      return true;
    });
    if (created) return code;
  }
  throw new Error('No se pudo crear la sala.');
}

export async function joinRoom(code, uid, name, organization) {
  authenticate(uid);
  const ref = roomRef(code);
  await runTransaction(db, async tx => {
    const room = await readRoom(tx, ref);
    if (room.players.some(p => p.uid === uid)) return;
    lobby(room);
    if (room.players.length >= 8) throw new Error('La sala está llena.');
    const player = member(uid, name, organization);
    tx.update(ref, { players: [...room.players, player] });
  });
  return code.toUpperCase();
}

export async function setRoomReady(code, uid, organization, ready) {
  authenticate(uid);
  if (typeof ready !== 'boolean') throw new Error('Estado inválido.');
  const updated = member(uid, '', organization);
  const ref = roomRef(code);
  await runTransaction(db, async tx => {
    const room = await readRoom(tx, ref);
    lobby(room);
    const player = room.players.find(p => p.uid === uid);
    if (!player) throw new Error('No perteneces a esta sala.');
    assertCanReady(player, ready);
    tx.update(ref, { players: room.players.map(p => p.uid === uid ? { ...p, organization: updated.organization, squad: updated.squad, teamName: updated.teamName, icon: updated.icon, isReady: ready } : p) });
  });
}

export async function setRoomParticipation(code, uid, targetUid, participating) {
  authenticate(uid);
  if (typeof participating !== 'boolean') throw new Error('Estado inválido.');
  const ref = roomRef(code);
  await runTransaction(db, async tx => {
    const room = await readRoom(tx, ref);
    lobby(room); host(room, uid);
    if (!room.players.some(p => p.uid === targetUid)) throw new Error('Jugador no encontrado.');
    tx.update(ref, { players: room.players.map(p => p.uid === targetUid ? participation(p, participating) : p) });
  });
}

export async function startRoomMajor(code, uid) {
  authenticate(uid);
  const ref = roomRef(code);
  const tournamentId = crypto.randomUUID();
  await runTransaction(db, async tx => {
    const room = await readRoom(tx, ref);
    host(room, uid);
    const players = readyPlayers(room);
    const locks = await Promise.all(players.map(p => tx.get(lockRef(p.organization.id))));
    if (locks.some(s => s.exists())) throw new Error('Una organización ya participa en otro Major.');
    const tournament = await initializeMultiplayerTournament(players);
    players.forEach(p => tx.set(lockRef(p.organization.id), { ownerUid: p.uid, roomId: room.id, tournamentId }));
    tx.update(ref, { status: 'playing', generation: (room.generation || 0) + 1, tournament: { ...tournament, tournamentId, participantUids: players.map(p => p.uid), matchesStarted: false } });
  });
}

export async function returnRoomToLobby(code, uid) {
  authenticate(uid);
  const ref = roomRef(code);
  await runTransaction(db, async tx => {
    const room = await readRoom(tx, ref);
    host(room, uid);
    const final = completedFinal(room);
    const participants = room.players.filter(p => p.participating);
    const locks = await Promise.all(participants.map(p => tx.get(lockRef(p.organization.id))));
    locks.forEach((s, i) => { if (s.exists() && s.data().roomId === room.id && s.data().tournamentId === room.tournament.tournamentId && s.data().ownerUid === participants[i].uid) tx.delete(s.ref); });
    tx.update(ref, { status: 'lobby', players: room.players.map(p => ({ ...p, participating: true, isReady: false })), lastMajor: { tournamentId: room.tournament.tournamentId, winner: final.result.winner } });
  });
}

export async function leaveRoom(code, uid) {
  authenticate(uid);
  const ref = roomRef(code);
  await runTransaction(db, async tx => {
    const room = await readRoom(tx, ref);
    lobby(room);
    if (!room.players.some(p => p.uid === uid)) return;
    const players = room.players.filter(p => p.uid !== uid);
    if (!players.length) { tx.delete(ref); return; }
    const hostId = room.hostId === uid ? players[0].uid : room.hostId;
    tx.update(ref, { hostId, players: players.map(p => ({ ...p, isHost: p.uid === hostId })) });
  });
}

export async function listPublicRooms() {
  const rooms = await getDocs(query(collection(db, 'rooms'), where('visibility', '==', 'public'), where('status', '==', 'lobby'), limit(50)));
  return rooms.docs.map(s => s.data());
}
