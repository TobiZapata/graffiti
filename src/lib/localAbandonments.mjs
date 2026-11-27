export const ABANDONMENTS_KEY = 'major-mvp:abandonments:v1';
export const ABANDONMENTS_EVENT = 'major-mvp:abandonments';

function validEntry(entry) {
  return entry && ['organizationId', 'roomId', 'tournamentId', 'reason', 'at']
    .every(field => typeof entry[field] === 'string' && entry[field].trim() !== '')
    && Number.isFinite(Date.parse(entry.at));
}

export function loadLocalAbandonments(storage) {
  try {
    const entries = JSON.parse(storage?.getItem(ABANDONMENTS_KEY) ?? 'null');
    return Array.isArray(entries) ? entries.filter(validEntry) : [];
  } catch {
    return [];
  }
}

export function recordLocalAbandonment(storage, { organizationId, roomId, tournamentId, reason, at = new Date().toISOString() } = {}) {
  const entry = { organizationId, roomId, tournamentId, reason, at };
  if (!storage || !validEntry(entry)) return false;

  const entries = loadLocalAbandonments(storage);
  if (entries.some(previous => previous.organizationId === organizationId && previous.tournamentId === tournamentId)) return false;

  try {
    storage.setItem(ABANDONMENTS_KEY, JSON.stringify([...entries, entry]));
  } catch {
    return false;
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(ABANDONMENTS_EVENT));
  return true;
}

export function countLocalAbandonments(storage, organizationId) {
  if (!organizationId) return 0;
  return loadLocalAbandonments(storage).filter(entry => entry.organizationId === organizationId).length;
}
