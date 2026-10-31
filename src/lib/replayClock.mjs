export function replayTime(clock, now) {
  return clock.time + Math.max(0, now - clock.at) / 1000 * clock.speed;
}

export function anchorReplay(time, speed, now) {
  return { time, speed, at: now };
}

export function nextReplayRound(clock, now, duration) {
  return anchorReplay(replayTime(clock, now) - duration, clock.speed, Math.max(now, clock.at));
}
