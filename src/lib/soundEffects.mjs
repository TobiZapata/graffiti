const MUTE_KEY = "major-mvp:muted";
let muted = false;
let audioContext;

export function isMuted() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return muted;
  }
}

export function toggleMuted() {
  const next = !isMuted();
  if (typeof window === "undefined") return next;
  muted = next;
  try {
    window.localStorage.setItem(MUTE_KEY, next ? "1" : "0");
  } catch {
    // Keep the preference for this tab when storage is blocked.
  }
  window.dispatchEvent(new Event(MUTE_KEY));
  return next;
}

export function subscribeMuted(onChange) {
  const onStorage = (event) => {
    if (event.key === MUTE_KEY || event.key === null) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(MUTE_KEY, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(MUTE_KEY, onChange);
  };
}

export async function prepareSoundEffects() {
  if (typeof window === "undefined") return;
  const AudioContext = window.AudioContext ?? window.webkitAudioContext;
  if (!AudioContext) return;
  try {
    if (!audioContext || audioContext.state === "closed") audioContext = new AudioContext();
    if (audioContext.state !== "running") {
      if (window.navigator?.userActivation?.hasBeenActive === false) return;
      await audioContext.resume();
    }
    return audioContext;
  } catch {
    // Audio is optional when the browser blocks it.
  }
}

async function playTones(tones, type = "sine") {
  if (isMuted()) return;
  const context = await prepareSoundEffects();
  if (!context || context.state !== "running" || isMuted()) return;
  const start = context.currentTime;
  for (const [frequency, offset, duration] of tones) {
    const at = start + offset;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(0.09, at + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, at + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(at);
    oscillator.stop(at + duration);
  }
}

export function playVetoAction(action) {
  if (action === "ban") return playTones([[330, 0, 0.07], [220, 0.06, 0.09]], "triangle");
  if (action === "pick") return playTones([[440, 0, 0.07], [587, 0.07, 0.11]], "triangle");
}

export function playMatchStart() {
  return playTones([[392, 0, 0.1], [523, 0.09, 0.12], [659, 0.18, 0.18]]);
}

export function playBombPlanted() {
  return playTones([[940, 0, 0.075], [940, 0.12, 0.075]], "triangle");
}

export function playBombDefused() {
  return playTones([[523, 0, 0.1], [784, 0.09, 0.18]]);
}
