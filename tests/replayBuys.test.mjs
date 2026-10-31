import test from 'node:test';
import assert from 'node:assert/strict';
import { createReplayEconomy, prepareReplayBuys } from '../src/lib/replayEconomy.mjs';
import { WEAPONS } from '../src/app/engines/WeaponEngine.js';
const roster = () => ({mainAwperUid:'0', players:Array.from({length:5}, (_, i) => ({uid:String(i), role:i ? 'RIFLER' : 'AWPER'}))});
const seed = n => () => ((n = (n * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const setup = money => { const a = roster(), b = roster(), state = createReplayEconomy(a,b); for (const p of [...state.A.players,...state.B.players]) p.money = money; return {a,b,state}; };
const buys = (s, round, random = seed(3), extra = {}) => prepareReplayBuys(s.state,s.a,s.b,{round,teamASide:'T',...extra},random);
test('demo prices and deterministic pistol templates', () => {
  assert.deepEqual([WEAPONS.GALIL.cost, WEAPONS.FAMAS.cost, WEAPONS.M4A4.cost],[1800,1950,2900]);
  const s = setup(800), original = structuredClone(s.state), result = buys(s,1);
  assert.deepEqual(result, buys(s,1)); assert.deepEqual(s.state,original);
  assert.ok([2,3,4,5].includes(result.state.A.players.filter(p => p.armor).length));
  assert.ok([3,4,5].includes(result.state.B.players.filter(p => p.armor).length));
  assert.ok(result.state.A.players.filter(p => p.inventory.includes('P250')).length <= 1);
  assert.ok(result.state.B.players.filter(p => p.inventory.includes('Dual Berettas')).length <= 2);
});
test('pistol loss responds to plant and CT can buy a scout without armor', () => {
  const s = setup(2000); s.state.A.lastResult = false; s.state.B.lastResult = false;
  let r = buys(s,2,()=>0); assert.equal(r.strategies.A,'ECO'); assert.ok(r.state.A.players.every(p => !p.inventory.includes('Galil AR')));
  s.state.A.previousPlanted = true; r = buys(s,2,()=>0); assert.equal(r.strategies.A,'FORCE');
  assert.ok(r.state.B.players.some(p => p.inventory.includes('SSG 08') && !p.armor));
});
test('bonus preserves saved guns and armor, swaps AWP without loss', () => {
  const s = setup(5000); s.state.A.recentWins = [true,true];
  s.state.A.players[0].inventory = ['AK-47']; s.state.A.players[1].inventory = ['AWP'];
  s.state.A.players[0].armor = 100; s.state.A.players[0].hasHelmet = true;
  const r = buys(s,3); assert.equal(r.strategies.A,'BONUS');
  assert.ok(r.state.A.players[0].inventory.includes('AWP')); assert.ok(r.state.A.players[1].inventory.includes('AK-47'));
  assert.equal(r.state.A.players[0].armorValue,0); assert.equal(r.actions.A.filter(a => a.type === 'buy' && a.item === 'AWP').length,0);
});
test('matchpoint and overtime half use full spending; purchases charge their actual payer', () => {
  const s = setup(2000); s.state.A.players[0].money = 10000;
  for (const proposal of [{round:10,scoreTeam2:12},{round:27},{round:30}]) {
    const r = buys(s,proposal.round,seed(8),proposal); assert.equal(r.strategies.A,'FULL_DUMP');
    for (const p of r.state.A.players) {
      const guns = r.actions.A.filter(a => a.type === 'buy' && a.payer === p.uid).reduce((sum,a) => sum + a.cost,0);
      assert.ok(p.money >= 0 && p.money <= 16000); assert.ok(s.state.A.players.find(x => x.uid === p.uid).money - p.money >= guns + p.armorValue + p.utilityValue);
    }
  }
});
test('weighted selection varies and never buys a held pistol again', () => {
  const seen = new Set();
  for (let n=1;n<50;n++) { const s=setup(4000); s.state.A.lastResult=true; for(const p of s.state.A.players) p.inventory=['P250']; const r=buys(s,2,seed(n)); for(const a of r.actions.A) { if(a.type==='buy') seen.add(a.item); assert.notEqual(a.item,'P250'); } }
  assert.ok(seen.has('AK-47') && seen.has('Galil AR') && seen.has('MAC-10'));
});
test('pistol upgrades follow team templates across seeds, including paid drops', () => {
  let t = 0, ct = 0, drops = 0;
  for (let n=1; n<=1000; n++) {
    const s = setup(800), r = buys(s,1,seed(n));
    t += r.state.A.players.filter(p => p.inventory.includes('P250')).length;
    ct += r.state.B.players.filter(p => p.inventory.includes('Dual Berettas')).length;
    drops += [...r.actions.A,...r.actions.B].filter(a => a.payer !== a.to).length;
  }
  assert.ok(t > 370 && t < 550, `T upgrades: ${t}`);
  assert.ok(ct > 750 && ct < 1030, `CT upgrades: ${ct}`);
  assert.ok(drops > 0);
});
test('eco pistols respect real reserve and vary; all-in buys affordable guns without armor reserve', () => {
  const seen = new Set();
  for (let n=1;n<=100;n++) {
    const s=setup(2700); s.state.A.lastResult=false;
    const r=buys(s,2,seed(n)); for (const a of r.actions.A) if(a.type==='buy') seen.add(a.item);
    for (const p of r.state.A.players) assert.ok(p.money >= 1800);
  }
  assert.ok(seen.has('P250') && seen.has('Desert Eagle') && seen.has('Tec-9'));
  const s=setup(0); s.state.A.players[0].money=1800;
  const r=buys(s,12,()=>0); assert.ok(r.state.A.players[0].inventory.includes('Galil AR'));
});
test('kit and weapon expenses are accounted and saved kits are not repurchased', () => {
  const s=setup(10000); s.state.B.players[0].hasKit=true;
  const r=buys(s,8,()=>0);
  assert.equal(r.state.B.players[0].kitValue,0);
  for (const key of ['A','B']) for (const p of r.state[key].players) {
    const cost=r.actions[key].filter(a=>a.type==='buy' && a.payer===p.uid).reduce((sum,a)=>sum+a.cost,0);
    assert.equal(s.state[key].players.find(x=>x.uid===p.uid).money-p.money,cost+p.armorValue+p.utilityValue+p.kitValue);
  }
});
test('M4 preferences persist, bonus avoids T AWP, and CT double AWP and SMG upgrades can occur', () => {
  let double=false, upgraded=false; const m4=new Set();
  for (let n=1;n<=200;n++) {
    const s=setup(10000); s.state.A.recentWins=[true,true]; s.state.A.players[1].inventory=['MAC-10'];
    s.state.B.players[1].m4Preference='M4A4'; s.state.B.players[2].m4Preference='M4A1S';
    const bonus=buys(s,3,seed(n)); assert.ok(bonus.state.A.players.every(p=>!p.inventory.includes('AWP')));
    assert.equal(bonus.state.B.players[1].m4Preference,'M4A4'); assert.equal(bonus.state.B.players[2].m4Preference,'M4A1S');
    const normal=buys(s,8,seed(n)); double ||= normal.state.B.players.filter(p=>p.inventory.includes('AWP')).length===2;
    upgraded ||= !normal.state.A.players[1].inventory.includes('MAC-10');
    for(const p of normal.state.B.players) for(const x of p.inventory) if(x==='M4A4'||x==='M4A1-S') m4.add(x);
  }
  assert.ok(double); assert.ok(upgraded); assert.equal(m4.size,2);
});
test('CT second-round loss cannot override opponent matchpoint', () => {
  const s=setup(2000); s.state.B.lastResult=false;
  const r=buys(s,14,()=>0.99,{scoreTeam1:12}); assert.equal(r.strategies.B,'FULL_DUMP');
});
test('bonus retains its reserve while permitting occasional SMG upgrades', () => {
  let retained=0, upgraded=0;
  for(let n=1;n<=400;n++) {
    const s=setup(5000); s.state.A.recentWins=[true,true];
    s.state.A.players[1].inventory=['MAC-10'];
    s.state.A.players[2].money=1000; s.state.A.players[2].inventory=['AK-47'];
    const r=buys(s,3,seed(n));
    assert.ok(r.state.A.players[2].money>=800);
    assert.equal(r.state.A.players[2].armorValue,0);
    if(r.state.A.players[1].inventory.includes('MAC-10')) retained++; else upgraded++;
  }
  assert.ok(upgraded>0 && retained>upgraded, `retained ${retained}, upgraded ${upgraded}`);
});
test('ordinary rounds can coordinate an eco for the next buy and value saved rifles', () => {
  let eco=0;
  for(let n=1;n<=100;n++) {
    const s=setup(3000); s.state.B.lastResult=false; s.state.B.lossBonus=2;
    const r=buys(s,8,seed(n));
    if(r.strategies.B==='ECO') { eco++; for(const p of r.state.B.players) assert.ok(p.money>=2300); }
  }
  assert.ok(eco>0);
  const s=setup(1000); for(const p of s.state.B.players) p.inventory=['M4A1-S'];
  const r=buys(s,8,seed(5)); assert.equal(r.strategies.B,'FULL');
});
