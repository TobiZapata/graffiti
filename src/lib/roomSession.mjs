export const SESSION_LEASE_MS = 180000;
export const SESSION_HEARTBEAT_MS = 30000;
const SESSION_KEY = 'major-mvp:room-session:v1', TAB_KEY = 'major-mvp:room-tab:v1';
let pageIdentity;

export function getPageSession() {
  if (!pageIdentity) {
    const tabId = sessionStorage.getItem(TAB_KEY) || crypto.randomUUID();
    sessionStorage.setItem(TAB_KEY, tabId);
    pageIdentity = { pageId: crypto.randomUUID(), tabId };
  }
  return pageIdentity;
}

export function readRoomSession() {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  const entry = JSON.parse(raw);
  if (!entry || !/^[A-Z0-9]{4}$/.test(entry.roomId) || typeof entry.pageId !== 'string' || typeof entry.tabId !== 'string') {
    throw new Error('Your saved room session could not be read.');
  }
  return entry;
}

export function rememberRoomSession(entry) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(entry));
  window.dispatchEvent(new Event('major-mvp-room-session'));
}

export function clearRoomSession() {
  sessionStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new Event('major-mvp-room-session'));
}

export function roomSessionExpired(session, now = Date.now()) {
  const heartbeat = session?.heartbeat?.toMillis?.() ?? (session?.heartbeat?.seconds * 1000);
  // A pending server timestamp is not evidence of a disconnected player.
  return !!session?.leaving || Number.isFinite(heartbeat) && heartbeat <= now - SESSION_LEASE_MS;
}

export function roomDeparture(room, uid, reason) {
  const target = room.players.find(p => p.uid === uid);
  if (!target || target.left || room.status === 'closed') return null;
  const forfeit = room.status === 'playing' && room.tournament.stage !== 'won' && target.participating;
  let players = room.status === 'lobby' && room.hostId !== uid ? room.players.filter(p => p.uid !== uid) :
    room.players.map(p => p.uid === uid ? { ...p, left: true, isReady: false } : p);
  const remaining = players.filter(p => !p.left);
  const closed = room.status === 'lobby' && room.hostId === uid || remaining.length === 0;
  const hostId = !closed && room.hostId === uid ? remaining[0].uid : room.hostId;
  players = players.map(p => ({ ...p, isHost: p.uid === hostId && (!p.left || room.status === 'lobby') }));
  const change = { players, hostId, lastDeparture: { uid, reason }, ...(closed ? { status: 'closed', closedReason: room.status === 'lobby' ? 'host-left' : 'empty' } : {}) };
  if (room.status === 'playing') change.tournament = { ...room.tournament,
    abandonedUids: forfeit ? [...new Set([...(room.tournament.abandonedUids || []), uid])] : room.tournament.abandonedUids || [],
    ...(closed && room.tournament.stage !== 'won' ? { stage: 'cancelled' } : {}) };
  return { change, target, forfeit, closed };
}
