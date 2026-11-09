import test from 'node:test';
import assert from 'node:assert/strict';
import { draftOffer } from '../src/lib/draftState.mjs';
import { restoreDraft, selectDraftTeam, pickDraftPlayer, draftPlayerStat } from '../src/components/play/draftFlow.mjs';

const teams = [1, 2, 3, 4].map(id => ({ id, name: `Team ${id}`, major: 'Major', mainAwperUid: String(id), players: [{ id, name: `Player ${id}`, awp: 90, rifler: 80, igl: 70 }] }));
const fresh = () => ({ seed: 'fixed', squad: [], rerollsLeft: 3, selectedTeamId: null });

test('team selection locks until a valid player is picked and survives reload', () => {
  const draft = fresh();
  const offer = draftOffer(draft.seed, 0, 3, teams);
  const team = teams.find(team => team.id === offer[0]);
  const locked = selectDraftTeam(draft, team.id, teams);
  assert.equal(selectDraftTeam(locked, offer[1], teams), locked);
  assert.equal(restoreDraft(JSON.parse(JSON.stringify(locked)), teams).selectedTeamId, team.id);
  assert.equal(pickDraftPlayer(draft, team.players[0], team), draft);
  assert.equal(pickDraftPlayer(locked, teams.find(other => other.id !== team.id).players[0], team), locked);
  const picked = pickDraftPlayer(locked, team.players[0], team);
  assert.equal(picked.squad.length, 1);
  assert.equal(picked.selectedTeamId, null);
  const duplicate = { ...picked, selectedTeamId: team.id };
  assert.equal(pickDraftPlayer(duplicate, team.players[0], team), duplicate);
});

test('invalid stored selection and teams outside offer are ignored', () => {
  const draft = fresh();
  assert.equal(selectDraftTeam(draft, 999, teams), draft);
  assert.equal(restoreDraft({ ...draft, selectedTeamId: 999 }, teams).selectedTeamId, null);
  assert.equal(restoreDraft(null, teams), null);
});

test('draft reveals one natural-role stat and final squad follows assigned roles', () => {
  const team = teams[0], player = team.players[0];
  assert.equal(draftPlayerStat(player, team), 'AWP 90');
  assert.equal(draftPlayerStat(player, { iglUid: String(player.id) }), 'IGL 70');
  assert.equal(draftPlayerStat(player, {}), 'Rifler 80');
  assert.equal(draftPlayerStat(player, team, { mainAwperUid: '0', iglUid: '0' }, 0), 'AWP 90');
  assert.equal(draftPlayerStat(player, team, { mainAwperUid: '1', iglUid: '0' }, 0), 'IGL 70');
});
