import test from 'node:test';
import assert from 'node:assert/strict';
import { member, organizationSnapshot, readyPlayers, completedFinal } from '../src/lib/roomLifecycle.mjs';

const org = { id: 'org', name: 'Team', icon: '/icon', colors: ['#123456', '#abcdef'], squad: Array.from({ length: 5 }, (_, i) => ({ player: { name: `P${i}` } })), mainAwperUid: '0', iglUid: '1', starUid: '2', createdAt: '2026-01-01', majorHistory: [] };
test('snapshots validate and do not share history or roster references', () => {
  const snapshot = organizationSnapshot(org);
  assert.equal(snapshot.majorHistory, undefined);
  snapshot.squad[0].player.name = 'Changed';
  assert.equal(org.squad[0].player.name, 'P0');
  assert.throws(() => organizationSnapshot({ ...org, id: 'a/b' }));
});

test('v2 snapshots retain scores, images and shared roles without mutating the organization', () => {
  const squad = org.squad.map((s,i)=>({player:{...s.player,personId:`person-${i}`,imageUrl:null,awp:70,rifler:80,igl:60,firepower:75,clutch:90}}));
  const next = {...org,squad,iglUid:'0'};
  const player = member('one','One',next);
  assert.deepEqual(player.squad,squad);
  assert.equal(player.organization.mainAwperUid,player.organization.iglUid);
  player.squad[0].player.clutch=0;
  assert.equal(next.squad[0].player.clutch,90);
  assert.throws(()=>organizationSnapshot({...next,squad:squad.map((s,i)=>i ? s : {player:{...s.player,firepower:101}})}));
});
test('start requires every lobby member to be ready, including previously excluded members', () => {
  const player = member('one', 'One', org, true);
  const room = { status: 'lobby', players: [player, { ...player, uid: 'two', participating: false }] };
  assert.throws(() => readyPlayers(room));
  room.players[0].isReady = true;
  assert.throws(() => readyPlayers(room));
  room.players[1].isReady = true;
  room.players[1].organization = { ...org, id: 'second-org' };
  assert.deepEqual(readyPlayers(room).map(p => p.uid), ['one', 'two']);
  assert.throws(() => readyPlayers({ ...room, status: 'playing' }));
});
test('multiplayer rejects incomplete organizations', () => {
  const incomplete = {...org,rosterVersion:1,squad:org.squad.slice(0,2),starUid:'0',bench:null,benchTokens:0,formerPlayers:[],rosterNotice:{majorId:'m',departed:[],acknowledged:false}};
  assert.throws(() => organizationSnapshot(incomplete));
  assert.throws(() => readyPlayers({status:'lobby',players:[{participating:true,isReady:true,organization:incomplete}]}));
});
test('only a finished final can return to lobby', () => {
  const final = { round: 'Final', completed: true, teamA: { id: 'a' }, teamB: { id: 'b' }, result: { winner: 'a' } };
  const room = { status: 'playing', tournament: { stage: 'won', matches: [final] } };
  assert.equal(completedFinal(room), final);
  assert.throws(() => completedFinal({ ...room, status: 'lobby' }));
  assert.throws(() => completedFinal({ ...room, tournament: { stage: 'won', matches: [{ ...final, result: { winner: 'other' } }] } }));
});
test('departed members do not block the next Major', () => {
  const player = { ...member('one', 'One', org, true), isReady: true };
  assert.deepEqual(readyPlayers({ status: 'lobby', players: [player, { ...player, uid: 'gone', left: true, isReady: false }] }), [player]);
});
