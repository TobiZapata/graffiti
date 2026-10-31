import test from 'node:test';
import assert from 'node:assert/strict';
import { CAREER_KEY, loadCareer, saveCareer, validCareer } from '../src/lib/localCareer.mjs';
const organization = { id:'id', name:'Team', icon:'/icon', colors:['#123456','#abcdef'], squad:Array.from({length:5},(_,i)=>({player:{name:`P${i}`}})), mainAwperUid:'0', iglUid:'1', starUid:'2', createdAt:'2026-01-01' };
const standings = Array.from({length:16},(_,i)=>({id:i ? `team${i}` : 'player_team',name:`Team${i}`,players:organization.squad.map(s=>s.player),isPlayer:i === 0,wins:0,losses:0}));
const match = { id:'m', round:1, teamA:standings[0], teamB:standings[1], completed:false, isPlayerMatch:true, result:null };
const data = {version:1, organization, tournament:{tournamentId:'major',mySquad:organization.squad,teamName:'Team',stage:'swiss',pendingResult:null,swissRound:1,standings,matches:[match]},matchProgress:{m:{history:[],watchedMap:-1,playback:{selection:0,time:0,speed:1}}}};
function storage(initial = null) { let value=initial; return {getItem:()=>value,setItem:(key,v)=>{assert.equal(key,CAREER_KEY);value=v}, value:()=>value}; }
test('round trips career and progress',()=>{ const store=storage(); assert.equal(saveCareer(store,data),null); assert.deepEqual(loadCareer(store).data,data); });
test('invalid saves are rejected without modifying original',()=>{ for (const raw of ['{',JSON.stringify({...data,version:2}),JSON.stringify({...data,tournament:{...data.tournament,matches:[{...match,teamB:{id:'missing'}}]}})]) { const store=storage(raw); assert.ok(loadCareer(store).error); assert.equal(store.value(),raw); } });
test('rejects invalid roles and progress references',()=>{ assert.equal(validCareer({...data,organization:{...organization,iglUid:'0'}}),false); assert.equal(validCareer({...data,matchProgress:{missing:data.matchProgress.m}}),false); });
test('storage failures are reported',()=>{ const store={getItem(){throw Error()},setItem(){throw Error()}}; assert.ok(loadCareer(store).error); assert.ok(saveCareer(store,data)); });
test('rejects broken rosters and completed or invalid progress without overwriting',()=>{
  const store=storage('original');
  const invalid = [
    {...data,tournament:{...data.tournament,mySquad:[null,...organization.squad.slice(1)]}},
    {...data,tournament:{...data.tournament,matches:[{...match,teamA:{id:'player_team'}}]}},
    {...data,tournament:{...data.tournament,standings:standings.map((t,i)=>i ? t : {...t,isPlayer:false})}},
    {...data,matchProgress:{m:{...data.matchProgress.m,history:[{map:'de_mirage',scoreA:13,scoreB:5,winnerId:'player_team'}]}}},
  ];
  for (const value of invalid) { assert.equal(validCareer(value),false); assert.ok(saveCareer(store,value)); assert.equal(store.value(),'original'); }
});
