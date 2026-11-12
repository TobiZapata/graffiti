export const CAREER_KEY = 'major-mvp:career:v1';
import { validSeriesProgress } from './replaySeries.mjs';
import { prepareReplayTeam } from './replayTeam.mjs';
import { isV2Player, validateV2Player } from './playerModel.mjs';
import { assertCompatibleSimulation } from './simulationVersion.mjs';
const text = value => typeof value === 'string' && value.trim().length > 0;
const number = value => Number.isFinite(value) && value >= 0;
const validPlayer = player => {
  if (!text(player?.name)) return false;
  try { if (isV2Player(player)) validateV2Player(player); return true; } catch { return false; }
};
const validTeam = team => {
  try {
    const prepared = prepareReplayTeam(team);
    return (team.starUid === undefined || prepared.players.some(p => p.uid === team.starUid)) && Number.isInteger(team.wins) && team.wins >= 0 && Number.isInteger(team.losses) && team.losses >= 0;
  } catch { return false; }
};

const validSlot = s => validPlayer(s?.player) && (s.gamesPlayed === undefined || Number.isInteger(s.gamesPlayed) && s.gamesPlayed >= 0) && (s.benchMajors === undefined || s.benchMajors === 0 || s.benchMajors === 1) &&
  (s.ratingTotal === undefined && s.ratingMatches === undefined || number(s.ratingTotal) && Number.isSafeInteger(s.ratingMatches) && s.ratingMatches >= 0 && (s.ratingMatches > 0 || s.ratingTotal === 0));

export function validOrganization(o) {
  if (!o || !text(o.id) || !text(o.name) || !text(o.icon) || !text(o.createdAt) || !Array.isArray(o.colors) || o.colors.length !== 2 || !o.colors.every(c => /^#[0-9a-f]{6}$/i.test(c)) || !Array.isArray(o.squad) || (o.rosterVersion === 1 ? o.squad.length < 2 || o.squad.length > 5 : o.squad.length !== 5) || !o.squad.every(s => o.rosterVersion === 1 ? validSlot(s) : validPlayer(s?.player))) return false;
  if (o.majorHistory !== undefined && (!Array.isArray(o.majorHistory) || !o.majorHistory.every(r => r && text(r.id) && (r.mode === undefined || ['offline', 'online'].includes(r.mode)) && ['champion','finalist','semifinal','quarterfinal','swiss'].includes(r.outcome) && typeof r.final === 'boolean' && r.final === ['champion','finalist'].includes(r.outcome) && Array.isArray(r.matches) && r.matches.every(m => m && text(m.name) && typeof m.major === 'string' && typeof m.won === 'boolean' && (m.icon === undefined || typeof m.icon === 'string') && (m.organizationId === undefined || typeof m.organizationId === 'string'))) || new Set(o.majorHistory.map(r => r.id)).size !== o.majorHistory.length)) return false;
  if (o.rosterVersion !== undefined && o.rosterVersion !== 1) return false;
  if (o.rosterVersion === 1 && ((o.bench != null && !validSlot(o.bench)) || (o.benchTokens !== undefined && ![0, 1].includes(o.benchTokens)) || (o.formerPlayers !== undefined && (!Array.isArray(o.formerPlayers) || o.formerPlayers.length > 5 || !o.formerPlayers.every(s => validSlot(s) && s.gamesPlayed > 0))) || (o.rosterNotice != null && (!text(o.rosterNotice.majorId) || !Array.isArray(o.rosterNotice.departed) || o.rosterNotice.departed.length > 4 || !o.rosterNotice.departed.every(d => text(d?.name) && ['performance', 'bench'].includes(d.reason) && (d.country == null || /^[a-z]{2}$/.test(d.country))) || typeof o.rosterNotice.acknowledged !== 'boolean')) || (o.rosterRevision !== undefined && (!Number.isInteger(o.rosterRevision) || o.rosterRevision < 0)))) return false;
  const slots = o.rosterVersion === 1 ? [...o.squad, ...(o.bench ? [o.bench] : []), ...(o.formerPlayers || [])] : o.squad;
  const names = slots.map(s => s.player.name.trim().toLowerCase());
  const people = slots.map(s => s.player.personId).filter(text);
  const ids = o.squad.map((_, i) => String(i));
  return new Set(names).size === names.length && new Set(people).size === people.length && ids.includes(o.mainAwperUid) && ids.includes(o.iglUid) && ids.includes(o.starUid);
}

export function validCareer(data) {
  if (!data || data.version !== 1 || !validOrganization(data.organization)) return false;
  const t = data.tournament;
  if (t === null) return !!data.matchProgress && typeof data.matchProgress === 'object' && !Array.isArray(data.matchProgress) && Object.keys(data.matchProgress).length === 0;
  try { assertCompatibleSimulation(t?.simulation); } catch { return false; }
  if (!t || !text(t.tournamentId) || !Array.isArray(t.mySquad) || t.mySquad.length !== 5 || !text(t.teamName) || !['swiss','swiss_complete','playoffs','results_pending','eliminated','won'].includes(t.stage) || ![null,'eliminated','won'].includes(t.pendingResult) || (t.stage === 'results_pending' && !t.pendingResult) || !Number.isInteger(t.swissRound) || t.swissRound < 1 || !Array.isArray(t.standings) || t.standings.length !== 16 || !Array.isArray(t.matches) || !data.matchProgress || typeof data.matchProgress !== 'object' || Array.isArray(data.matchProgress)) return false;
  if (!t.mySquad.every(s => validPlayer(s?.player)) || (t.rosterTarget !== undefined && !['champion', 'finalist', 'semifinal', 'quarterfinal', 'swiss'].includes(t.rosterTarget))) return false;
  const ids = new Set(t.standings.map(team => team?.id));
  if (ids.size !== 16 || !ids.has('player_team') || !t.standings.every(team => text(team.id) && validTeam(team) && team.isPlayer === (team.id === 'player_team'))) return false;
  const matchIds = new Set();
  for (const m of t.matches) {
    if (!text(m.id) || matchIds.has(m.id) || !(Number.isInteger(m.round) && m.round > 0 || ['Quarterfinals','Semifinals','Final'].includes(m.round)) || !ids.has(m.teamA?.id) || !ids.has(m.teamB?.id) || m.teamA.id === m.teamB.id || ![m.teamA,m.teamB].every(team => validTeam(team) && team.isPlayer === (team.id === 'player_team')) || typeof m.completed !== 'boolean' || m.isPlayerMatch !== (m.teamA.isPlayer || m.teamB.isPlayer)) return false;
    if (m.completed && (!m.result || m.result.teamA?.id !== m.teamA.id || m.result.teamB?.id !== m.teamB.id || ![m.teamA.id,m.teamB.id].includes(m.result.winner) || !number(m.result.scoreA) || !number(m.result.scoreB))) return false;
    if (!m.completed && m.result !== null) return false;
    matchIds.add(m.id);
  }
  return Object.entries(data.matchProgress).every(([id, p]) => {
    const m = t.matches.find(match => match.id === id);
    return m && !m.completed && m.isPlayerMatch && validSeriesProgress(m, p);
  });
}

export function loadCareer(storage) {
  try {
    const raw = storage.getItem(CAREER_KEY);
    if (raw === null) return { data: null, error: null };
    const data = JSON.parse(raw);
    if (!validCareer(data)) throw new Error('Invalid career save');
    return { data, error: null };
  } catch {
    return { data: null, error: 'Your saved game could not be read. The original save was kept.' };
  }
}

export function saveCareer(storage, data) {
  try {
    if (!validCareer(data)) throw new Error('Invalid career save');
    storage.setItem(CAREER_KEY, JSON.stringify(data));
    return null;
  } catch {
    return 'Your game could not be saved.';
  }
}
