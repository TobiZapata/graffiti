import test from 'node:test';
import assert from 'node:assert/strict';
import { CAREER_KEY, loadCareer, saveCareer, validCareer, validOrganization } from '../src/lib/localCareer.mjs';
import { upgradeOrganization } from '../src/lib/upgradeOrganization.mjs';
const organization = { id:'id', name:'Team', icon:'/icon', colors:['#123456','#abcdef'], squad:Array.from({length:5},(_,i)=>({player:{name:`P${i}`}})), mainAwperUid:'0', iglUid:'1', starUid:'2', createdAt:'2026-01-01' };
const standings = Array.from({length:16},(_,i)=>({id:i ? `team${i}` : 'player_team',name:`Team${i}`,players:organization.squad.map(s=>s.player),isPlayer:i === 0,wins:0,losses:0}));
const match = { id:'m', round:1, teamA:standings[0], teamB:standings[1], completed:false, isPlayerMatch:true, result:null };
const data = {version:1, organization, tournament:{tournamentId:'major',mySquad:organization.squad,teamName:'Team',stage:'swiss',pendingResult:null,swissRound:1,standings,matches:[match]},matchProgress:{m:{history:[],watchedMap:-1,playback:{selection:0,time:0,speed:1}}}};
function storage(initial = null) { let value=initial; return {getItem:()=>value,setItem:(key,v)=>{assert.equal(key,CAREER_KEY);value=v}, value:()=>value}; }
test('round trips career and progress',()=>{ const store=storage(); assert.equal(saveCareer(store,data),null); assert.deepEqual(loadCareer(store).data,data); });
test('upgrades the benched player without losing slot metadata or changing identities',()=>{
  const player={id:1,name:'Bench',personId:'person',awp:70,rifler:70,igl:70,firepower:70,clutch:70};
  const slot={player:{id:1,name:'Bench',personId:'person'},team:{name:'Team',major:'Major'},gamesPlayed:3,benchMajors:1};
  const org={squad:[],bench:slot};
  const catalog=[{name:'Team',major:'Major',players:[player]}];
  assert.deepEqual(upgradeOrganization(org,catalog).bench,{...slot,player});
  assert.equal(upgradeOrganization(org,[{...catalog[0],players:[{...player,personId:'other'}]}]),org);
});

test('incomplete organizations round trip while the Major retains its five-player snapshot',()=>{
  const org={...organization,rosterVersion:1,squad:organization.squad.slice(0,2),starUid:'0',bench:null,benchTokens:1,formerPlayers:[],rosterNotice:{majorId:'major',departed:[],acknowledged:false}};
  const saved={...data,organization:org,tournament:{...data.tournament,rosterTarget:'swiss'}};
  const store=storage();
  assert.equal(saveCareer(store,saved),null);
  assert.deepEqual(loadCareer(store).data,saved);
  assert.equal(validOrganization({...org,rosterVersion:undefined}),false);
  assert.equal(validCareer({...saved,tournament:{...saved.tournament,rosterTarget:'invalid'}}),false);
  for (const invalid of [
    {...org,benchTokens:2}, {...org,rosterRevision:-1}, {...org,bench:{player:{name:'P0'}}},
    {...org,squad:[{player:{name:'A',personId:'same'}},org.squad[1]],bench:{player:{name:'B',personId:'same'}}},
    {...org,formerPlayers:[{player:{name:'P0'},gamesPlayed:1}]},
    {...org,formerPlayers:[{player:{name:'Former'},gamesPlayed:0}]},
    {...org,formerPlayers:Array.from({length:6},(_,i)=>({player:{name:`Former${i}`},gamesPlayed:1}))},
    {...org,rosterNotice:{...org.rosterNotice,departed:[{name:'P0',reason:'other'}]}},
    {...org,rosterNotice:{...org.rosterNotice,departed:[{name:'P0',reason:'bench',country:'../../x'}]}},
    {...org,squad:[{...org.squad[0],gamesPlayed:-1},org.squad[1]]},
  ]) assert.equal(validOrganization(invalid),false);
});

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
