import assert from 'node:assert/strict';
import test from 'node:test';
import { replayBestOf, replaySeriesResult, validSeriesProgress } from '../src/lib/replaySeries.mjs';

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
