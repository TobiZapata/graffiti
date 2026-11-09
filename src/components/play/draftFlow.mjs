import { draftOffer, readDraft, sameDraftPlayer } from '../../lib/draftState.mjs';
import { rosterPlayerAttribute } from '../../lib/majorDisplay.mjs';

export function restoreDraft(saved, teams, legacyTeams = []) {
  const draft = readDraft(saved, teams, legacyTeams);
  if (!draft) return null;
  const offer = draftOffer(draft.seed, draft.squad.length, draft.rerollsLeft, teams);
  return { ...draft, selectedTeamId: offer.includes(saved.selectedTeamId) ? saved.selectedTeamId : null };
}

export function selectDraftTeam(draft, teamId, teams) {
  if (draft.selectedTeamId != null || !draftOffer(draft.seed, draft.squad.length, draft.rerollsLeft, teams).includes(teamId)) return draft;
  return { ...draft, selectedTeamId: teamId };
}

export function pickDraftPlayer(draft, player, team) {
  if (draft.squad.length >= 5 || draft.selectedTeamId !== team.id || !team.players.includes(player) || draft.squad.some(slot => sameDraftPlayer(slot.player, player))) return draft;
  return { ...draft, selectedTeamId: null, squad: [...draft.squad, { player, team: { name: team.name, major: team.major } }] };
}

export function draftPlayerStat(player, team, roles, index) {
  const uid = roles ? String(index) : String(player.id);
  if (!roles && team?.mainAwperUid === uid && team?.iglUid === uid) {
    return `AWP ${Number.isFinite(player.awp) ? player.awp : '—'} · IGL ${Number.isFinite(player.igl) ? player.igl : '—'}`;
  }
  return rosterPlayerAttribute(player, roles || team || {}, uid);
}
