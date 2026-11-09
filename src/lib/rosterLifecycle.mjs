import seedrandom from 'seedrandom';
import { draftOffer, sameDraftPlayer } from './draftState.mjs';
import { buildMajorRecord, playerRatingTotals } from './organizationProfile.mjs';
import { isV2Player, PLAYER_SCORES } from './playerModel.mjs';

const outcomes = ['champion', 'finalist', 'semifinal', 'quarterfinal', 'swiss'];
const roles = ['starUid', 'iglUid', 'mainAwperUid'];
const validId = value => typeof value === 'string' && value.trim().length > 0;
const revision = org => (org.rosterRevision || 0) + 1;
const identityConflict = (a, b) => sameDraftPlayer(a, b) || a?.name?.trim().toLowerCase() === b?.name?.trim().toLowerCase();
const score = player => {
  const fields = isV2Player(player) ? PLAYER_SCORES : ['aim', 'gamesense', 'positioning', 'utility', 'clutch', 'entry', 'aggression', 'composure'];
  const scores = fields.map(key => player?.[key]).filter(Number.isFinite);
  return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : (Number.isFinite(player?.rating) ? player.rating : 0);
};
const average = players => players.reduce((sum, player) => sum + score(player), 0) / players.length;
function checkOrg(org) {
  if (!validId(org?.id) || !Array.isArray(org.squad) || org.squad.length < 2 || org.squad.length > 5 || !org.squad.every(slot => validId(slot?.player?.name))) throw new Error('Invalid roster');
}
function checkIndex(org, index) {
  checkOrg(org);
  if (!Number.isInteger(index) || index < 0 || index >= org.squad.length) throw new Error('Invalid roster index');
}
function remap(org, squad) {
  const result = { ...org, squad };
  for (const role of roles) {
    const oldIndex = Number(org[role]);
    const old = Number.isInteger(oldIndex) && String(oldIndex) === org[role] ? org.squad[oldIndex] : null;
    const index = old ? squad.indexOf(old) : -1;
    result[role] = String(index < 0 ? 0 : index);
  }
  return result;
}
function archive(former, slot) {
  const existing = former.find(s => identityConflict(s.player, slot.player));
  const remaining = former.filter(s => !identityConflict(s.player, slot.player));
  const candidate = { ...slot, benchMajors: 0, gamesPlayed: Math.max(slot.gamesPlayed || 0, existing?.gamesPlayed || 0) };
  return [...remaining, candidate].filter(s => s.gamesPlayed > 0).sort((a, b) => b.gamesPlayed - a.gamesPlayed).slice(0, 5);
}
export function expectedMajorOutcome(org, catalog) {
  checkOrg(org);
  if (!Array.isArray(catalog) || catalog.some(team => !Array.isArray(team.players) || !team.players.length)) throw new Error('Invalid catalog');
  const own = average(org.squad.map(slot => slot.player));
  const rank = 1 + catalog.filter(team => average(team.players) > own).length;
  return rank === 1 ? 'champion' : rank === 2 ? 'finalist' : rank <= 4 ? 'semifinal' : rank <= 8 ? 'quarterfinal' : 'swiss';
}
export function departureProbabilities(org, tournament) {
  checkOrg(org);
  const target = outcomes.indexOf(tournament?.rosterTarget);
  const actual = outcomes.indexOf(buildMajorRecord(tournament || {}).outcome);
  if (target < 0 || actual < 0) throw new Error('Invalid Major outcome or target');
  const difference = actual - target;
  return difference < 0 ? [85, 15, 0, 0] : difference === 0 ? [65, 30, 5, 0] : difference === 1 ? [40, 40, 17, 3] : [20, 45, 25, 10];
}
export function finishRosterMajor(org, tournament) {
  checkOrg(org);
  if (!validId(tournament?.tournamentId) || !Array.isArray(tournament.matches)) throw new Error('Invalid Major');
  const history = org.majorHistory || [];
  if (history.some(record => record.id === tournament.tournamentId)) return org;
  const record = buildMajorRecord(tournament);
  if (!tournament.matches.some(m => m.completed && m.isPlayerMatch)) throw new Error('No completed player matches');
  const weights = departureProbabilities(org, tournament);
  const random = seedrandom(`${org.id}:${tournament.tournamentId}`);
  let roll = random() * 100, count = 0;
  while (count < 3 && roll >= weights[count]) roll -= weights[count++];
  count = Math.min(count, org.squad.length - 2);
  const indexes = org.squad.map((_, index) => index).filter(index => String(index) !== org.starUid);
  for (let i = indexes.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [indexes[i], indexes[j]] = [indexes[j], indexes[i]]; }
  const departing = new Set(indexes.slice(0, count));
  const games = tournament.matches.filter(m => m.completed && m.isPlayerMatch && !m.result?.forfeit).length;
  const baseline = history.reduce((sum, record) => sum + (record.matches?.length || 0), 0);
  let former = [...(org.formerPlayers || [])], bench = org.bench || null;
  const departed = [];
  const survivors = org.squad.filter((slot, index) => {
    if (!departing.has(index)) return true;
    former = archive(former, { ...slot, ...playerRatingTotals(slot, tournament.matches), gamesPlayed: (slot.gamesPlayed ?? baseline) + games, benchMajors: 0 });
    departed.push({ name: slot.player.name, reason: 'performance' });
    return false;
  });
  const mapped = remap(org, survivors);
  mapped.squad = survivors.map(slot => ({ ...slot, ...playerRatingTotals(slot, tournament.matches), gamesPlayed: (slot.gamesPlayed ?? baseline) + games, benchMajors: 0 }));
  if (bench) {
    bench = { ...bench, benchMajors: (bench.benchMajors || 0) + 1 };
    if (bench.benchMajors >= 2) { former = archive(former, bench); departed.push({ name: bench.player.name, reason: 'bench' }); bench = null; }
  }
  return { ...mapped, bench, formerPlayers: former, majorHistory: [...history, record], benchTokens: 1, rosterVersion: 1, rosterRevision: revision(org), rosterNotice: { majorId: tournament.tournamentId, departed, acknowledged: departed.length === 0 } };
}
export function benchRosterPlayer(org, index) {
  checkIndex(org, index);
  if (org.squad.length !== 5 || org.bench || org.benchTokens !== 1) throw new Error('Cannot bench player');
  return { ...remap(org, org.squad.filter((_, i) => i !== index)), bench: { ...org.squad[index], benchMajors: org.squad[index].benchMajors || 0 }, benchTokens: 0, rosterRevision: revision(org) };
}
export function swapBenchPlayer(org, index) {
  checkIndex(org, index);
  if (!org.bench) throw new Error('No bench player');
  const squad = [...org.squad]; squad[index] = org.bench;
  return { ...remap(org, squad), bench: org.squad[index] };
}
export function promoteBenchPlayer(org) {
  checkOrg(org);
  if (!org.bench || org.squad.length >= 5) throw new Error('Cannot promote player');
  return { ...org, squad: [...org.squad, org.bench], bench: null };
}
export function releaseBenchPlayer(org) {
  checkOrg(org);
  if (!org.bench) throw new Error('No bench player');
  return { ...org, bench: null, formerPlayers: archive(org.formerPlayers || [], org.bench) };
}
export function replacementOffer(org, catalog) {
  checkOrg(org);
  if (!Array.isArray(catalog) || catalog.some(team => team?.id == null || !Array.isArray(team.players))) throw new Error('Invalid catalog');
  const owned = [...org.squad, ...(org.bench ? [org.bench] : [])];
  const available = catalog.filter(team => team.players.some(player => !owned.some(slot => identityConflict(slot.player, player))));
  return draftOffer(`${org.id}:${org.rosterRevision || 0}`, org.squad.length, 0, available);
}
export function recruitRosterPlayer(org, player, team, catalog) {
  checkOrg(org);
  if (org.squad.length >= 5 || !validId(player?.name)) throw new Error('Cannot recruit player');
  const offered = replacementOffer(org, catalog);
  const foundTeam = catalog.find(t => offered.includes(t.id) && (team?.id != null ? t.id === team.id : t.name === team?.name && t.major === team?.major));
  const foundPlayer = foundTeam?.players.find(p => player.id != null ? p.id === player.id : p.name === player.name);
  if (!foundPlayer || [...org.squad, ...(org.bench ? [org.bench] : [])].some(slot => identityConflict(slot.player, foundPlayer))) throw new Error('Player unavailable');
  const former = org.formerPlayers || [];
  // shortcut: only the five retained former players recover past stats; add a separate ledger if every return must retain them.
  const previous = former.find(slot => sameDraftPlayer(slot.player, foundPlayer));
  return { ...org, squad: [...org.squad, { player: foundPlayer, team: { name: foundTeam.name, major: foundTeam.major }, gamesPlayed: previous?.gamesPlayed || 0, ratingTotal: previous?.ratingTotal || 0, ratingMatches: previous?.ratingMatches || 0, benchMajors: 0 }], formerPlayers: former.filter(slot => !identityConflict(slot.player, foundPlayer)), rosterRevision: revision(org) };
}
export function assertFullRoster(org) {
  checkOrg(org);
  if (org.squad.length !== 5) throw new Error('A full roster is required');
}
