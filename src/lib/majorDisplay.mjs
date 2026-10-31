// Display helpers shared by the draft, the hub and the Major screens.
import { replayBestOf } from './replaySeries.mjs';

const STATS = ['aim', 'gamesense', 'positioning', 'utility', 'clutch', 'entry', 'aggression', 'composure'];
const ROLES = { AWPER: 'AWPer', RIFLER: 'Rifler', ENTRY: 'Entry', SUPPORT: 'Support', IGL: 'IGL', LURKER: 'Lurker' };

export const ROLE_FIELDS = { mainAwperUid: 'AWPer', iglUid: 'IGL', starUid: 'Star' };

// "ESL One Cologne 2014" -> "Cologne '14". The same team often played several Majors, and two of them
// were in 2014, so the event's short name is what tells two rosters apart.
const EVENT_NAMES = [['Katowice', 'Katowice'], ['Cologne', 'Cologne'], ['DreamHack', 'DreamHack']];

export function teamEvent(team) {
  const major = team?.major || '';
  const year = /\b(20\d\d)\b/.exec(major)?.[1];
  if (!year) return '';
  const name = EVENT_NAMES.find(([key]) => major.includes(key))?.[1];
  return name ? `${name} '${year.slice(2)}` : `'${year.slice(2)}`;
}

export function teamLabel(team) {
  if (!team) return '';
  const event = teamEvent(team);
  return event ? `${team.name} · ${event}` : team.name;
}

export function roleLabel(role) {
  return ROLES[String(role || '').toUpperCase()] || role || '';
}

// Mean of the attributes the simulation reads; null when the player has none.
export function playerOverall(player) {
  const values = STATS.map(stat => player?.[stat]).filter(Number.isFinite);
  return values.length ? Math.round(values.reduce((sum, v) => sum + v, 0) / values.length) : null;
}

export function record(team) {
  return `${team?.wins ?? 0}–${team?.losses ?? 0}`;
}

const lostIn = (matches, team, round) => matches.find(m => m.round === round && m.completed &&
  (m.teamA.id === team.id || m.teamB.id === team.id) && m.result.winner !== team.id);

export function placement(team, matches) {
  if (!team) return { text: '', weight: 99 };
  if (team.wins >= 3) {
    const final = matches.find(m => m.round === 'Final' && m.completed && (m.teamA.id === team.id || m.teamB.id === team.id));
    if (final) return final.result.winner === team.id ? { text: 'Champion', weight: 1 } : { text: 'Runner-up', weight: 2 };
    if (lostIn(matches, team, 'Semifinals')) return { text: 'Semifinals, 3rd–4th', weight: 3 };
    if (lostIn(matches, team, 'Quarterfinals')) return { text: 'Quarterfinals, 5th–8th', weight: 5 };
    return { text: 'Playoffs', weight: 8 };
  }
  if (team.wins === 2) return { text: 'Swiss stage, 9th–11th', weight: 9 };
  if (team.wins === 1) return { text: 'Swiss stage, 12th–14th', weight: 12 };
  return { text: 'Swiss stage, 15th–16th', weight: 15 };
}

export const PLAYOFF_ROUNDS = ['Quarterfinals', 'Semifinals', 'Final'];

// Page title and its quiet second line for each tournament stage.
export function majorHeading(stage, swissRound, matches) {
  if (stage === 'swiss') return ['Swiss stage', `Round ${swissRound} of 5`];
  if (stage === 'swiss_complete') return ['Swiss stage', 'Complete'];
  if (stage === 'playoffs') return ['Playoffs', matches.find(m => PLAYOFF_ROUNDS.includes(m.round) && !m.completed)?.round || ''];
  return ['Major results', ''];
}

export function opponentOf(match, teamId) {
  if (!match) return null;
  return match.teamA.id === teamId ? match.teamB : match.teamA;
}

export function matchFormat(match) {
  return match ? `BO${replayBestOf(match)}` : '';
}
