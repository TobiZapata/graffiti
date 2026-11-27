import assert from 'node:assert/strict';
import test from 'node:test';
import { replayBestOf, replaySeriesResult, validSeriesProgress } from '../src/lib/replaySeries.mjs';
import { createMapVeto, applyMapVeto, vetoStatus } from '../src/lib/mapVeto.mjs';
import { advanceMultiplayerVeto, createMultiplayerVeto, validMultiplayerVeto } from '../src/lib/multiplayerVeto.mjs';

const match = (round = 1, wins = 0, losses = 0) => ({round, teamA:{id:'a',wins,losses},teamB:{id:'b',wins,losses}});
const map = winnerId => ({map:'de_mirage',scoreA:winnerId==='a'?13:8,scoreB:winnerId==='b'?13:8,winnerId});
test('saved replay progress rejects completed series and invalid playback or results', () => {
  const p = {history:[],watchedMap:-1,playback:{selection:0,time:37,speed:4}};
  assert.ok(validSeriesProgress(match(),p));
  for (const invalid of [{...p,history:[map('a')]},{...p,history:[null]},{...p,playback:{...p.playback,time:Infinity}},{...p,playback:{...p.playback,selection:-1}},{...p,watchedMap:1}]) assert.equal(validSeriesProgress(match(),invalid),false);
  assert.ok(validSeriesProgress(match('Final'),{...p,history:[map('a')]}));
});
test('Swiss qualification and elimination matches use BO3; playoffs retain BO3 and BO5', () => {
  assert.equal(replayBestOf(match()),1);
  assert.equal(replayBestOf(match(2,1,0)),1);
  for(const m of [match(3,2,0),match(3,0,2),match(5,2,2),match('Quarterfinals'),match('Semifinals')]) assert.equal(replayBestOf(m),3);
  assert.equal(replayBestOf(match('Final')),5);
});

for (const bestOf of [1, 3, 5]) {
  test(`a direct PvP match uses BO${bestOf} for veto, saved playback and final score`, () => {
    const direct = { ...match('Single match'), bestOf };
    const seed = 'room:series:single:veto';
    assert.equal(replayBestOf(direct), bestOf);
    let shared = createMultiplayerVeto('series', 'single', 0, replayBestOf(direct), seed, 1_000);
    while (!vetoStatus(shared.veto).done) {
      const { turn, remaining } = vetoStatus(shared.veto);
      shared = advanceMultiplayerVeto(shared, {
        actionIndex: shared.veto.actions.length, playerTeam: turn, map: remaining[0],
        now: shared.turnDeadlineMs - 1, vetoSeed: seed,
      });
    }
    assert.ok(validMultiplayerVeto(shared, 'series', 'single', 0, bestOf));
    const { maps } = vetoStatus(shared.veto);
    assert.equal(maps.length, bestOf);
    const played = maps.map((id, index) => ({ ...map(index % 2 ? 'b' : 'a'), map: id }));
    const history = played.slice(0, -1);
    assert.ok(validSeriesProgress(direct, {
      veto: shared.veto, vetoStarted: true, history, map: maps.at(-1), watchedMap: -1, playback: null,
    }));
    assert.equal(replaySeriesResult(direct, history).done, false);
    const { done, result } = replaySeriesResult(direct, played);
    assert.equal(done, true);
    assert.equal(result.winner, 'a');
    assert.deepEqual([result.scoreA, result.scoreB], bestOf === 1 ? [13, 8] : [(bestOf + 1) / 2, (bestOf - 1) / 2]);
  });
}
test('series counts map wins, stops at majority and reports BO1 rounds', () => {
  assert.equal(replaySeriesResult(match(),[]).done,false);
  assert.deepEqual([replaySeriesResult(match(),[map('b')]).result.scoreA,replaySeriesResult(match(),[map('b')]).result.scoreB],[8,13]);
  const m=match(3,2,0),history=[map('a'),map('b')];
  assert.equal(replaySeriesResult(m,history).done,false);
  const result=replaySeriesResult(m,[...history,map('a')]);
  assert.equal(result.done,true);assert.equal(result.result.winner,'a');
  assert.deepEqual([result.result.scoreA,result.result.scoreB],[2,1]);
  assert.equal(result.result.maps.length,3);
  assert.equal(replaySeriesResult(match('Final'),[map('a'),map('a')]).done,false);
  assert.equal(replaySeriesResult(match('Final'),[map('a'),map('a'),map('a')]).done,true);
});

test('supports Dust2 progress while retaining legacy saves', () => {
  const progress = { history: [{ ...map('a'), map: 'de_dust2' }], watchedMap: 0, playback: null };
  assert.ok(validSeriesProgress(match('Final'), progress));
  assert.ok(validSeriesProgress(match('Final'), { ...progress, map: 'de_dust2' }));
  assert.ok(validSeriesProgress(match('Final'), { ...progress, map: 'de_dust2', dust2BankVersion: 'v1.0.0' }));
  assert.equal(validSeriesProgress(match('Final'), { ...progress, dust2BankVersion: 'unknown' }), false);
  assert.equal(validSeriesProgress(match('Final'), { ...progress, map: 'de_other' }), false);
});

test('supports Nuke progress and rejects unknown maps', () => {
  const progress = { map: 'de_nuke', history: [{ ...map('a'), map: 'de_nuke' }], watchedMap: 0, playback: null };
  assert.ok(validSeriesProgress(match('Final'), progress));
  assert.ok(validSeriesProgress(match('Final'), { ...progress, nukeBankVersion: 'v1.0.0' }));
  assert.equal(validSeriesProgress(match('Final'), { ...progress, nukeBankVersion: 'unknown' }), false);
  assert.equal(validSeriesProgress(match('Final'), { ...progress, history: [{ ...map('a'), map: 'de_other' }] }), false);
});

test('new maps survive saved series validation', () => {
  for (const id of ['de_anubis', 'de_cache', 'de_inferno', 'de_ancient']) {
    assert.ok(validSeriesProgress(match('Final'), { map: id, history: [{ ...map('a'), map: id }], watchedMap: 0, playback: null }));
  }
});

test('series progress follows the veto order and rejects changed or premature maps', () => {
  const m = match('Semifinals');
  let veto = createMapVeto(3, 'series-veto');
  while (!vetoStatus(veto).done) veto = applyMapVeto(veto, vetoStatus(veto).remaining[0]);
  const maps = vetoStatus(veto).maps;
  const progress = { veto, vetoStarted: true, map: maps[1], history: [{ ...map('a'), map: maps[0] }], watchedMap: -1, playback: null };
  assert.ok(validSeriesProgress(m, progress));
  assert.equal(validSeriesProgress(m, { ...progress, map: maps[0] }), false);
  assert.equal(validSeriesProgress(m, { ...progress, history: [{ ...map('a'), map: maps[2] }] }), false);
  assert.equal(validSeriesProgress(m, { ...progress, veto: { ...veto, actions: veto.actions.slice(0, 3) } }), false);
  assert.equal(validSeriesProgress(m, { ...progress, vetoStarted: false }), false);
});
