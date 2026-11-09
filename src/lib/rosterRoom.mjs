import { expectedMajorOutcome } from './rosterLifecycle.mjs';

// Room teams use UID-based IDs; career records describe only this organization's matches.
export function rosterMajorFromRoom(room, uid, organization) {
  const t = room?.tournament;
  const participant = room?.players?.find(p => p.uid === uid && p.organization?.id === organization?.id);
  if (!t?.tournamentId || !participant || !t.participantUids?.includes(uid) || t.abandonedUids?.includes(uid) || organization.majorHistory?.some(r => r.id === t.tournamentId)) return null;
  const me = t.standings?.find(team => team.uid === uid);
  if (!me) return null;
  const mine = (t.matches || []).filter(m => m.teamA.id === me.id || m.teamB.id === me.id);
  const playoffLoss = mine.some(m => typeof m.round === 'string' && m.completed && m.result.winner !== me.id);
  const final = mine.find(m => m.round === 'Final' && m.completed);
  if (me.losses < 3 && !playoffLoss && t.stage !== 'won') return null;
  const stage = final?.result.winner === me.id ? 'won' : 'eliminated';
  const team = value => ({ ...value, id: value.id === me.id ? 'player_team' : value.id, isPlayer: value.id === me.id });
  return {
    tournamentId: t.tournamentId, stage, pendingResult: null,
    rosterTarget: expectedMajorOutcome({ ...organization, squad: participant.squad }, t.standings.filter(other => other.id !== me.id)),
    matches: mine.map(m => ({ ...m, isPlayerMatch: true, teamA: team(m.teamA), teamB: team(m.teamB),
      result: m.result ? { ...m.result, winner: m.result.winner === me.id ? 'player_team' : m.result.winner } : null }))
  };
}
