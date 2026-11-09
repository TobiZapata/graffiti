import test from 'node:test';
import assert from 'node:assert/strict';
import { CAREER_KEY, loadCareer, saveCareer, validCareer, validOrganization } from '../src/lib/localCareer.mjs';
const organization = { id:'id', name:'Team', icon:'/icon', colors:['#123456','#abcdef'], squad:Array.from({length:5},(_,i)=>({player:{name:`P${i}`}})), mainAwperUid:'0', iglUid:'1', starUid:'2', createdAt:'2026-01-01' };
const standings = Array.from({length:16},(_,i)=>({id:i ? `team${i}` : 'player_team',name:`Team${i}`,players:organization.squad.map(s=>s.player),isPlayer:i === 0,wins:0,losses:0}));
const match = { id:'m', round:1, teamA:standings[0], teamB:standings[1], completed:false, isPlayerMatch:true, result:null };
const data = {version:1, organization, tournament:{tournamentId:'major',mySquad:organization.squad,teamName:'Team',stage:'swiss',pendingResult:null,swissRound:1,standings,matches:[match]},matchProgress:{m:{history:[],watchedMap:-1,playback:{selection:0,time:0,speed:1}}}};
function storage(initial = null) { let value=initial; return {getItem:()=>value,setItem:(key,v)=>{assert.equal(key,CAREER_KEY);value=v}, value:()=>value}; }
test('round trips career and progress',()=>{ const store=storage(); assert.equal(saveCareer(store,data),null); assert.deepEqual(loadCareer(store).data,data); });

test('stored v2 and v3 Majors retain their exact engine descriptor after loading',()=>{
  for (const engineVersion of [2,3]) {
    const simulation={engineVersion,playerDataVersion:'players-v2.0.0',bankVersion:'mirage-economy-v1'};
    const saved={...data,tournament:{...data.tournament,simulation}};
    const raw=JSON.stringify(saved), store=storage(raw);
    assert.deepEqual(loadCareer(store).data,saved);
    assert.equal(store.value(),raw);
  }
});
test('invalid saves are rejected without modifying original',()=>{ for (const raw of ['{',JSON.stringify({...data,version:2}),JSON.stringify({...data,tournament:{...data.tournament,matches:[{...match,teamB:{id:'missing'}}]}})]) { const store=storage(raw); assert.ok(loadCareer(store).error); assert.equal(store.value(),raw); } });
test('rejects invalid roles and progress references',()=>{ assert.equal(validCareer({...data,organization:{...organization,iglUid:'5'}}),false); assert.equal(validCareer({...data,matchProgress:{missing:data.matchProgress.m}}),false); });

test('v2 organizations allow shared roles and validate every score without changing legacy snapshots',()=>{
  const squad = organization.squad.map((s,i)=>({player:{...s.player,personId:`person-${i}`,awp:0,rifler:100,igl:70,firepower:80,clutch:65}}));
  const org = {...organization,squad,iglUid:'0'};
  assert.equal(validOrganization(org),true);
  const saved = {...data,organization:org};
  const store=storage();
  assert.equal(saveCareer(store,saved),null);
  assert.deepEqual(loadCareer(store).data.tournament,data.tournament);
  for (const field of ['awp','rifler','igl','firepower','clutch']) {
    for (const value of [undefined,null,'80',-1,101,1.5,NaN]) {
      const invalid={...org,squad:squad.map((s,i)=>i ? s : {player:{...s.player,[field]:value}})};
      assert.equal(validOrganization(invalid),false,`${field}: ${value}`);
    }
  }
  assert.equal(validOrganization({...org,squad:squad.map((s,i)=>i===1 ? {player:{...s.player,personId:'person-0',name:'Alias'}} : s)}),false);
  assert.equal(validOrganization({...org,squad:squad.map((s,i)=>i ? s : {player:{name:'Partial',awp:80}})}),false);
});
test('storage failures are reported',()=>{ const store={getItem(){throw Error()},setItem(){throw Error()}}; assert.ok(loadCareer(store).error); assert.ok(saveCareer(store,data)); });
test('unsupported simulation versions preserve the saved career',()=>{
  const raw=JSON.stringify({...data,tournament:{...data.tournament,simulation:{engineVersion:999}}});
  const store=storage(raw);
  assert.ok(loadCareer(store).error);
  assert.equal(store.value(),raw);
});
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
