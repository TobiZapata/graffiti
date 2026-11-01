import test from 'node:test';
import assert from 'node:assert/strict';
import { anchorReplay, nextReplayRound, replayTime } from '../src/lib/replayClock.mjs';

test('elapsed time crosses several rounds and reaches the map end', () => {
  let clock = anchorReplay(3, 2, 1000);
  for (const duration of [8, 10, 6]) clock = nextReplayRound(clock, 12500, duration);
  assert.equal(replayTime(clock, 12500), 2);
  assert.ok(replayTime(clock, 14500) >= 6);
});

test('anchors preserve pause, speed and seek boundaries', () => {
  let clock = anchorReplay(4, 1, 1000);
  const paused = replayTime(clock, 3000);
  clock = anchorReplay(paused, 2, 10000);
  assert.equal(replayTime(clock, 11000), 8);
  clock = anchorReplay(1, 2, 11000);
  assert.equal(replayTime(clock, 11500), 2);
  assert.equal(replayTime(clock, 10999), 1);
});
