"use client";

import { useEffect, useEffectEvent, useId, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { decodeReplay, sampleReplay, worldToRadar } from "../lib/roundBankReplay.mjs";
import { readReplayJSON } from "../lib/readReplayJSON.mjs";
import { cachedWeaponIcon, replayWeaponIcon } from "../lib/replayWeaponIcon.mjs";
import mirageRadar from "../../public/maps/mirage/de_mirage_radar_psd.webp";
import dust2Radar from "../../public/maps/dust/de_dust2_radar_psd.png";
import nukeRadar from "../../public/maps/nuke/de_nuke_composite_radar.png";
import anubisRadar from "../../public/maps/anubis/de_anubis_radar_psd.png";
import cacheRadar from "../../public/maps/cache/de_cache_radar_psd.png";
import infernoRadar from "../../public/maps/inferno/de_inferno_radar_psd.png";
import ancientRadar from "../../public/maps/ancient/de_ancient_radar_psd.png";
import { splitRadarTrail } from "./splitRadarTrail.mjs";
import { REPLAY_MAPS } from "../lib/replayMaps.mjs";
import { replayProgress } from "../lib/replayProgress.mjs";
import { anchorReplay, nextReplayRound, replayTime } from "../lib/replayClock.mjs";
import { mostExpensiveWeapon } from "../lib/replayEquipment.mjs";
import { isMuted, playBombDefused, playBombPlanted, prepareSoundEffects, subscribeMuted, toggleMuted } from "../lib/soundEffects.mjs";
import styles from "./RoundBankViewer.module.css";
import ReplayMatchLayout from "./ReplayMatchLayout";
import ReplayRoundTimer from "./ReplayRoundTimer";
import PlayerIdentity from "./PlayerIdentity";

const BASE = "/round-bank-lab";
const COLORS = { T: "#e0b45a", CT: "#79a6dc" };
const GRENADE_EFFECT_COLORS = { smoke: "#b2bcb988", fire: "#ee9d4588", he: "#4ade80aa" };
const WIN_LABELS = { ELIMINATION: "elimination", DEFUSE: "bomb defused", BOMB_EXPLOSION: "bomb exploded", TIME: "time ran out" };
const timeLabel = (time) => `${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, "0")}`;

function WeaponIcon({ weapon }) {
  const [failedSource, setFailedSource] = useState(null);
  const source = cachedWeaponIcon(replayWeaponIcon(weapon));
  if (!source || failedSource === source) return <span>{weapon || "—"}</span>;
  // SVG silhouettes are served directly and retain a text fallback if the asset fails to load.
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={styles.weaponIcon} src={source} alt={weapon} title={weapon}
    width="88" height="28" onError={() => setFailedSource(source)} />;
}

function TeamList({ side, sample, round }) {
  return <section className={styles.team} aria-label={`${side} players`}>
    <h2 style={{ color: COLORS[side] }}>{side}{round.meta.macro && ` · ${round.meta.macro[side === "T" ? "teamT" : "teamCT"]}`}</h2>
    {round.players.filter((p) => p.side === side).map((actor) => {
      const player = sample.players.find((p) => p.id === actor.id);
      const kills = sample.events.filter((e) => e.type === "player_death" && e.attacker === actor.id &&
        round.sides[e.victim] && round.sides[e.victim] !== actor.side && !["c4", "planted_c4"].includes(e.weapon)).length;
      return <div key={actor.id} className={`${styles.player} ${!player.alive ? styles.dead : ""}`}>
        <div><strong>{actor.name}</strong><span>{kills} K · {player.alive ? `${player.health} HP` : "Dead"}</span></div>
        <span className={styles.playerWeapons}>
          <span className={styles.inventoryWeapon} role="group" aria-label="Most valuable weapon" title="Most valuable weapon">
            {player.alive ? <WeaponIcon weapon={mostExpensiveWeapon(player.inventory)} /> : "—"}
          </span>
          <span className={styles.activeWeapon} role="group" aria-label="Weapon in hand" title="Weapon in hand">
            {player.alive ? <WeaponIcon weapon={player.weapon} /> : "—"}
          </span>
        </span>
        {player.defuse && <label className={styles.defuse}>Defusing
          <progress aria-label={`${actor.name} defuse progress`} max="1" value={player.defuse.progress} />
        </label>}
      </div>;
    })}
  </section>;
}

function playerRadarLayers(p, map) {
  if (!map.composite || typeof p.z !== "number") return [{ key: p.id, position: worldToRadar(p, map), alpha: 1 }];
  const band = 55;
  const threshold = map.composite.lowerBelowZ;
  if (p.z >= threshold + band || p.z <= threshold - band) {
    return [{ key: p.id, position: worldToRadar(p, map), alpha: 1 }];
  }
  const upperAlpha = (p.z - (threshold - band)) / (2 * band);
  return [
    { key: `${p.id}:u`, position: worldToRadar({ ...p, z: threshold + band }, map), alpha: upperAlpha },
    { key: `${p.id}:l`, position: worldToRadar({ ...p, z: threshold - band }, map), alpha: 1 - upperAlpha },
  ];
}

function Radar({ sample, round, matchMode }) {
  const bombMask = useId();
  const map = REPLAY_MAPS[round.meta.map];
  const point = (p) => worldToRadar(p, map);
  return <svg className={matchMode ? `${styles.radar} ${styles.matchRadar}` : styles.radar} viewBox={`0 0 1024 ${map.composite ? 1088 : 1024}`} role="img" aria-label={`${map.label} radar with player positions`}>
    <defs><mask id={bombMask} maskUnits="userSpaceOnUse" x="-10" y="-10" width="20" height="20">
      <image href={`/weapons/other/${sample.bomb?.status === "exploded" ? "planted_c4" : "c4"}.svg`} x="-10" y="-10" width="20" height="20" />
    </mask></defs>
    <image href={({ de_mirage: mirageRadar, de_dust2: dust2Radar, de_nuke: nukeRadar, de_anubis: anubisRadar, de_cache: cacheRadar, de_inferno: infernoRadar, de_ancient: ancientRadar })[round.meta.map].src} width="1024" height={map.composite ? 1088 : 1024} />
    {map.composite && <g opacity="0.45" fill="#d4d4d8" fontSize="22" fontWeight="700" letterSpacing="3">
      <text x="36" y="54">UPPER · A</text>
      <line x1="36" y1="548" x2="988" y2="548" stroke="#ffffff" strokeOpacity="0.22" strokeWidth="2" strokeDasharray="8 8" />
      <text x="36" y="586">LOWER · B</text>
    </g>}
    {sample.effects.map((effect) => {
      const p = point(effect);
      return <circle key={effect.id} cx={p.x} cy={p.y} r={effect.kind === "smoke" ? 29 : effect.kind === "fire" ? 22 : 8}
        fill={GRENADE_EFFECT_COLORS[effect.kind] ?? "#fff3bcaa"} />;
    })}
    {sample.grenades.map((grenade) => {
      const p = point(grenade);
      const color = grenade.kind === "he" ? "#4ade80" : "#fff0b8";
      return <g key={grenade.id}>{splitRadarTrail(grenade.trail, map).map((trail, index) => <polyline key={index}
        points={trail.map((v) => { const q = point(v); return `${q.x},${q.y}`; }).join(" ")}
        fill="none" stroke={color} strokeWidth="2" />)}<circle cx={p.x} cy={p.y} r="5" fill={color} /></g>;
    })}
    {sample.players.flatMap((p) => {
      const actor = round.players.find((a) => a.id === p.id);
      return playerRadarLayers(p, map).map(({ key, position, alpha }) => (
      <g key={key} transform={`translate(${position.x},${position.y})`} opacity={(p.alive ? 1 : .45) * alpha}>
        <title>{actor.name}: {p.alive ? `${p.health} HP, ${p.weapon}` : "dead"}</title>
        {p.alive ? <><circle r="10" fill={COLORS[actor.side]} stroke="#000" strokeWidth="2" />
          <path d="M 12 -5 L 21 0 L 12 5" fill={COLORS[actor.side]} transform={`rotate(${-p.yaw})`} /></> :
          <path d="M -6 -6 L 6 6 M 6 -6 L -6 6" stroke={COLORS[actor.side]} strokeWidth="3" />}
        <text y="-16" textAnchor="middle" fill="white" stroke="#000" strokeWidth="3" paintOrder="stroke" fontSize="15">{actor.name}</text>
        {p.defuse && <g><image href={`${BASE}/map_defuse.svg`} x="-9" y="14" width="18" height="18" />
          <rect x="-20" y="34" width="40" height="5" fill="#000" />
          <rect x="-20" y="34" width={40 * p.defuse.progress} height="5" fill="#5cc489" /></g>}
      </g>));
    })}
    {sample.bomb && (() => { const p = point(sample.bomb), carried = sample.bomb.status === "carried";
      return <g transform={`translate(${p.x + (carried ? 13 : 0)},${p.y + (carried ? 13 : 0)}) scale(${carried ? .8 : 1})`}>
      <rect x="-10" y="-10" width="20" height="20" mask={`url(#${bombMask})`}
        fill={sample.bomb.status === "defused" ? "#5cc489" : ["planted", "exploded"].includes(sample.bomb.status) ? "#e5634d" : "#fff"} />
      <title>Bomb: {sample.bomb.status}</title>
    </g>; })()}
  </svg>;
}

function ReplayKillFeed({ deaths, name, sides }) {
  return <section className={styles.compactFeed} aria-label="Round kills">
    {deaths.slice(-3).map((e, i) => {
      const bombKill = ["c4", "planted_c4"].includes(e.weapon);
      return <p key={`${e.t}-${i}`}>
        {!bombKill && <strong style={{ color: COLORS[sides[e.attacker]] }}>{name(e.attacker)}</strong>}
        <span className={styles.killWeapon}><WeaponIcon weapon={bombKill ? "planted_c4" : e.weapon} />
          {!bombKill && e.headshot && <Image src="/modifiers/icon_headshot.svg" alt="Headshot" width={13} height={13} />}
          {!bombKill && e.thrusmoke && <Image src="/modifiers/smoke_kill.svg" alt="Through smoke" width={13} height={13} />}
          {!bombKill && e.penetrated > 0 && <Image src="/modifiers/penetrate.svg" alt="Wallbang" width={13} height={13} />}
        </span>
        <strong style={{ color: COLORS[sides[e.victim]] }}>{name(e.victim)}</strong>
      </p>;
    })}
  </section>;
}

export default function RoundBankViewer({ catalog: suppliedCatalog = null, matchMode = false, onComplete, backHref = "/", teamA, teamB, seriesState, initialPlayback = null, onPlaybackChange, selectedRounds = null, allowShortcuts = true, initialSpeed = 1, showControls = process.env.NODE_ENV === "development", isMultiplayer = false }) {
  const canControl = showControls && !isMultiplayer && process.env.NODE_ENV === "development";
  const [fetchedCatalog, setCatalog] = useState(null);
  const catalog = suppliedCatalog ?? fetchedCatalog;
  const [selection, setSelection] = useState(() => {
    const saved = Math.min(initialPlayback?.selection ?? 0, Math.max(0, (suppliedCatalog?.rounds.length ?? 1) - 1));
    return selectedRounds?.find(index => index >= saved) ?? selectedRounds?.at(-1) ?? saved;
  });
  const [furthestSelection, setFurthestSelection] = useState(selection);
  const [loaded, setLoaded] = useState(null);
  const [error, setError] = useState("");
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(canControl ? initialPlayback?.speed ?? initialSpeed : initialSpeed);
  const speedRef = useRef(speed);
  const restoredPlayback = useRef(initialPlayback);
  const clock = useRef(null);
  const continuing = useRef(false);
  const completed = useRef(false);
  const previousBomb = useRef(null);
  const muted = useSyncExternalStore(subscribeMuted, isMuted, () => false);
  const [retry, setRetry] = useState(0);
  const round = loaded?.selection === selection ? loaded.round : null;
  const nextSelection = selectedRounds ? selectedRounds.find(index => index > selection) : selection + 1;
  const previousSelection = selectedRounds?.filter(index => index < selection).at(-1) ?? -1;
  const omittedRounds = selectedRounds ? selection - previousSelection - 1 : 0;

  useEffect(() => {
    if (suppliedCatalog) return;
    const controller = new AbortController();
    readReplayJSON(`${BASE}/index.json`, controller.signal).then(setCatalog).catch((e) => {
      if (e.name !== "AbortError") setError(e.message);
    });
    return () => controller.abort();
  }, [suppliedCatalog]);

  useEffect(() => {
    if (!catalog) return;
    const controller = new AbortController();
    const info = catalog.rounds[selection];
    readReplayJSON(info.replay_data_ref, controller.signal).then((raw) => {
      const decoded = decodeReplay(raw, { ...info,
        endsMatch: info.endsMatch || !!(info.macro && selection === catalog.rounds.length - 1),
      }, info.names ?? catalog.names);
      const saved = restoredPlayback.current;
      const position = saved?.selection === selection ? Math.min(saved.time, decoded.duration) : 0;
      restoredPlayback.current = null;
      if (!continuing.current) {
        clock.current = anchorReplay(position, speedRef.current, performance.now());
        setPlaying(!canControl || (matchMode && saved?.selection !== selection));
      }
      continuing.current = false;
      setTime(position);
      setError("");
      setLoaded({ selection, round: decoded });
    }).catch((e) => { if (e.name !== "AbortError") setError(e.message); });
    return () => controller.abort();
  }, [catalog, selection, matchMode, retry, canControl]);

  const notifyPlaybackChange = useEffectEvent((state) => onPlaybackChange?.(state));
  const notifyComplete = useEffectEvent(() => onComplete?.());

  const elapsedSecond = Math.floor(time);
  useEffect(() => {
    if (round) notifyPlaybackChange({ selection, time: elapsedSecond, speed });
  }, [round, selection, elapsedSecond, speed]);

  useEffect(() => {
    if (!playing || !round) return;
    let request, ended = false;
    const advance = (now) => {
      if (ended) return;
      const position = replayTime(clock.current, now);
      setTime(Math.min(round.duration, position));
      if (position >= round.duration) {
        ended = true;
        if (matchMode && nextSelection !== undefined && nextSelection < catalog.rounds.length) {
          clock.current = nextReplayRound(clock.current, now, round.duration);
          continuing.current = true;
          setSelection(nextSelection);
          setFurthestSelection(previous => Math.max(previous, nextSelection));
        } else {
          clock.current = anchorReplay(round.duration, speed, now);
          setPlaying(false);
          if (matchMode && !completed.current) { completed.current = true; notifyComplete(); }
        }
      }
    };
    const frame = now => { advance(now); if (!ended) request = requestAnimationFrame(frame); };
    const tick = () => advance(performance.now());
    request = requestAnimationFrame(frame);
    // Hidden tabs can stop animation frames; coarse ticks and elapsed time keep the match moving.
    const timer = setInterval(tick, 1000), initial = setTimeout(tick, 0);
    document.addEventListener('visibilitychange', tick);
    return () => { clearTimeout(initial); clearInterval(timer); cancelAnimationFrame(request); document.removeEventListener('visibilitychange', tick); };
  }, [playing, round, speed, matchMode, selection, nextSelection, catalog]);

  const seek = (value) => { clock.current = anchorReplay(value, speed, performance.now()); setTime(value); };
  const sample = round ? sampleReplay(round, time) : null;
  const bombStatus = sample?.bomb?.status;

  useEffect(() => {
    const activateAudio = (event) => {
      if (!event.isTrusted) return;
      void prepareSoundEffects();
      window.removeEventListener("click", activateAudio);
    };
    window.addEventListener("click", activateAudio);
    return () => window.removeEventListener("click", activateAudio);
  }, []);

  useEffect(() => {
    const previous = previousBomb.current;
    previousBomb.current = { round, status: bombStatus };
    if (!round || previous?.round !== round || previous.status === bombStatus) return;
    if (bombStatus === "planted") void playBombPlanted();
    if (bombStatus === "defused") void playBombDefused();
  }, [round, bombStatus]);

  const togglePlayback = () => {
    if (!round) return;
    if (playing) seek(Math.min(round.duration, replayTime(clock.current, performance.now())));
    else seek(time >= round.duration ? 0 : time);
    setPlaying(!playing);
  };

  const changeSpeed = (value) => {
    const now = performance.now();
    speedRef.current = value;
    clock.current = anchorReplay(playing ? replayTime(clock.current, now) : time, value, now);
    setSpeed(value);
  };

  const changeRound = (index) => {
    continuing.current = false;
    setPlaying(false);
    setError("");
    setSelection(index);
    setFurthestSelection(previous => Math.max(previous, index));
  };

  const handleShortcut = useEffectEvent((event) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.target instanceof HTMLElement &&
      (event.target.closest("button, input, textarea, select") || event.target.isContentEditable)) return;
    if (event.code === "Space" || event.key === " ") {
      event.preventDefault();
      if (!event.repeat) {
        void prepareSoundEffects();
        togglePlayback();
      }
    } else if (["1", "2", "4"].includes(event.key)) {
      event.preventDefault();
      if (!event.repeat) changeSpeed(Number(event.key));
    } else if (event.key === "ArrowRight" && nextSelection !== undefined && nextSelection < (catalog?.rounds.length ?? 0)) {
      event.preventDefault();
      if (!event.repeat) changeRound(nextSelection);
    }
  });

  useEffect(() => {
    if (!canControl || !allowShortcuts) return;
    const onKeyDown = (event) => handleShortcut(event);
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [allowShortcuts, canControl]);

  const name = (id) => round?.players.find(p => p.id === id)?.name || "World";
  const deaths = sample?.events.filter((e) => e.type === "player_death") || [];
  const finished = Boolean(sample?.result);
  const progress = matchMode && round ? replayProgress(catalog.rounds, selection, round, sample) : null;

  const controls = <div className={styles.toolbar}>
    <div className={styles.controls}>
      {canControl && <>
        {!matchMode && round && <ReplayRoundTimer round={round} sample={sample} />}
        <button type="button" disabled={!round} onClick={togglePlayback}>{playing ? "Pause" : "Play"}</button>
        <label>Round <select value={selection} disabled={!catalog} onChange={(e) => changeRound(Number(e.target.value))}>
          {catalog?.rounds.map((r, i) => (!selectedRounds || i === selection || (selectedRounds.includes(i) && i <= furthestSelection)) && <option key={`${r.round_id}:${i}`} value={i}>Round {r.round}{!matchMode && ` · ${r.win_condition}`}</option>)}</select></label>
        {selectedRounds && <span role="status">Highlights{omittedRounds > 0 && ` · ${omittedRounds} round${omittedRounds === 1 ? "" : "s"} omitted`}</span>}
        <button type="button" disabled={!round} onClick={() => { setPlaying(false); seek(0); }}>Restart round</button>
        <label>Speed <select value={speed} onChange={(e) => changeSpeed(Number(e.target.value))}>
          {[.5, 1, 2, 4, 8].map((s) => <option key={s} value={s}>{s}×</option>)}</select></label>
      </>}
      <button type="button" className={styles.soundButton} aria-label="Mute sound" aria-pressed={muted}
        title={muted ? "Unmute sound" : "Mute sound"} onClick={toggleMuted}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 9v6h4l5 4V5L7 9H3Z" />
          {muted ? <path d="m16 10 5 5m0-5-5 5" /> : <path d="M16 9a4 4 0 0 1 0 6m3-9a8 8 0 0 1 0 12" />}
        </svg>
      </button>
      {canControl && <>
        {round && <span className={styles.status} aria-live="polite">{finished ? `${round.meta.winner_side} win · ${WIN_LABELS[round.meta.win_condition] || round.meta.win_condition}` : "Round in progress"}
          {sample.bomb && ` · bomb ${sample.bomb.status}`}</span>}
        <output>{timeLabel(time)} / {timeLabel(round?.duration || 0)}</output>
      </>}
    </div>
    {canControl && round && <input className={styles.seek} aria-label="Playback position" type="range" min="0" max={round.duration} step=".015625" value={time}
      onChange={(e) => seek(Number(e.target.value))} />}
  </div>;

  return <main className={`${styles.lab} ${matchMode ? styles.matchMode : ""}`}>
    {!matchMode && <header className={styles.header}><div><p>{REPLAY_MAPS[catalog?.rounds[0]?.map ?? 'de_mirage'].label}</p><h1>{suppliedCatalog ? `${REPLAY_MAPS[catalog.rounds[0].map].label} BO1` : "Recorded round test"}</h1>
      <span>{catalog?.source.demo.replace(/\.dem$/, "") || "Loading round bank…"}</span></div>
      <Link href={backHref}>Back to home</Link></header>}
    {!matchMode && controls}
    {error && <p role="alert" className={styles.error}>{error} {catalog && <button type="button" onClick={() => { setError(""); setRetry(retry + 1); }}>Try again</button>}</p>}
    {!round && !error && <p role="status">Loading round…</p>}
    {round && <>
      {!matchMode && round.meta.macro && <p className={styles.note}>
        {round.meta.macro.teamASide === "T" ? round.meta.macro.teamT : round.meta.macro.teamCT} {round.meta.macro.scoreTeam1} – {round.meta.macro.scoreTeam2} {round.meta.macro.teamASide === "T" ? round.meta.macro.teamCT : round.meta.macro.teamT}
        {` · ${round.meta.macro.overtime ? `OT ${round.meta.macro.overtime}` : `Half ${round.meta.macro.half}`}`}{` · Source: ${round.meta.demo_id.slice(0, 8)}, round ${round.meta.source_round}`}
      </p>}
      {matchMode ? <ReplayMatchLayout catalog={catalog} selection={selection} round={round} sample={sample}
        progress={progress} teamA={teamA} teamB={teamB} seriesState={seriesState} controls={controls}
        radar={<><Radar sample={sample} round={round} matchMode />
          <ReplayKillFeed deaths={deaths} name={name} sides={round.sides} /></>} /> : <div className={styles.match}>
        <TeamList side="T" sample={sample} round={round} /><Radar sample={sample} round={round} />
        <ReplayKillFeed deaths={deaths} name={name} sides={round.sides} />
        <TeamList side="CT" sample={sample} round={round} />
      </div>}
      {progress && <details className={styles.stats}><summary>Match stats</summary>
        <table><thead><tr><th>Player</th><th>Team</th><th>K</th><th>D</th><th>A</th><th>Flash assists</th></tr></thead>
          <tbody>{progress.players.map((player, i) => {
            const roster = player.team === "A" ? teamA : teamB;
            const identity = roster?.players?.find(p => p.name === player.name) ?? player;
            return <tr key={i}><td><PlayerIdentity player={identity} /></td><td>{player.team === "A" ? (round.meta.macro.teamASide === "T" ? round.meta.macro.teamT : round.meta.macro.teamCT) : (round.meta.macro.teamASide === "T" ? round.meta.macro.teamCT : round.meta.macro.teamT)}</td><td>{player.kills}</td><td>{player.deaths}</td><td>{player.assists}</td><td>{player.flashAssists}</td></tr>;
          })}</tbody></table>
      </details>}
      {!matchMode && <p className={styles.note}>Recorded round. The defuse bar uses sampled states and may differ slightly from the exact start. Utility areas are approximate.</p>}
    </>}
  </main>;
}
