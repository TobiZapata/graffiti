"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { decodeReplay, sampleReplay, worldToRadar } from "../lib/roundBankReplay.mjs";
import { readReplayJSON } from "../lib/readReplayJSON.mjs";
import { cachedWeaponIcon, replayWeaponIcon } from "../lib/replayWeaponIcon.mjs";
import mirageRadar from "../../public/maps/mirage/de_mirage_radar_psd.webp";
import dust2Radar from "../../public/maps/dust/de_dust2_radar_psd.png";
import { REPLAY_MAPS } from "../lib/replayMaps.mjs";
import { replayProgress } from "../lib/replayProgress.mjs";
import { anchorReplay, nextReplayRound, replayTime } from "../lib/replayClock.mjs";
import { mostExpensiveWeapon } from "../lib/replayEquipment.mjs";
import styles from "./RoundBankViewer.module.css";
import ReplayMatchLayout from "./ReplayMatchLayout";
import ReplayRoundTimer from "./ReplayRoundTimer";
import PlayerIdentity from "./PlayerIdentity";

const BASE = "/round-bank-lab";
const COLORS = { T: "#e0b45a", CT: "#79a6dc" };
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

function Radar({ sample, round }) {
  const bombMask = useId();
  const map = REPLAY_MAPS[round.meta.map];
  const point = (p) => worldToRadar(p, map);
  return <svg className={styles.radar} viewBox="0 0 1024 1024" role="img" aria-label={`${map.label} radar with player positions`}>
    <defs><mask id={bombMask} maskUnits="userSpaceOnUse" x="-10" y="-10" width="20" height="20">
      <image href={`/weapons/other/${sample.bomb?.status === "exploded" ? "planted_c4" : "c4"}.svg`} x="-10" y="-10" width="20" height="20" />
    </mask></defs>
    <image href={(round.meta.map === 'de_dust2' ? dust2Radar : mirageRadar).src} width="1024" height="1024" />
    {sample.effects.map((effect) => {
      const p = point(effect);
      return <circle key={effect.id} cx={p.x} cy={p.y} r={effect.kind === "smoke" ? 29 : effect.kind === "fire" ? 22 : 8}
        fill={effect.kind === "smoke" ? "#b2bcb988" : effect.kind === "fire" ? "#ee9d4588" : "#fff3bcaa"} />;
    })}
    {sample.grenades.map((grenade) => {
      const p = point(grenade);
      return <g key={grenade.id}><polyline points={grenade.trail.map((v) => { const q = point(v); return `${q.x},${q.y}`; }).join(" ")}
        fill="none" stroke="#fff0b8" strokeWidth="2" /><circle cx={p.x} cy={p.y} r="5" fill="#fff0b8" /></g>;
    })}
    {sample.players.map((p) => {
      const position = point(p), actor = round.players.find((a) => a.id === p.id);
      return <g key={p.id} transform={`translate(${position.x},${position.y})`} opacity={p.alive ? 1 : .45}>
        <title>{actor.name}: {p.alive ? `${p.health} HP, ${p.weapon}` : "dead"}</title>
        {p.alive ? <><circle r="10" fill={COLORS[actor.side]} stroke="#000" strokeWidth="2" />
          <path d="M 12 -5 L 21 0 L 12 5" fill={COLORS[actor.side]} transform={`rotate(${-p.yaw})`} /></> :
          <path d="M -6 -6 L 6 6 M 6 -6 L -6 6" stroke={COLORS[actor.side]} strokeWidth="3" />}
        <text y="-16" textAnchor="middle" fill="white" stroke="#000" strokeWidth="3" paintOrder="stroke" fontSize="15">{actor.name}</text>
        {p.defuse && <g><image href={`${BASE}/map_defuse.svg`} x="-9" y="14" width="18" height="18" />
          <rect x="-20" y="34" width="40" height="5" fill="#000" />
          <rect x="-20" y="34" width={40 * p.defuse.progress} height="5" fill="#5cc489" /></g>}
      </g>;
    })}
    {sample.bomb && (() => { const p = point(sample.bomb), carried = sample.bomb.status === "carried";
      return <g transform={`translate(${p.x + (carried ? 13 : 0)},${p.y + (carried ? 13 : 0)}) scale(${carried ? .8 : 1})`}>
      <rect x="-10" y="-10" width="20" height="20" mask={`url(#${bombMask})`}
        fill={sample.bomb.status === "defused" ? "#5cc489" : ["planted", "exploded"].includes(sample.bomb.status) ? "#e5634d" : "#fff"} />
      <title>Bomb: {sample.bomb.status}</title>
    </g>; })()}
  </svg>;
}

function ReplayKillFeed({ deaths, name, sides = {}, compact = false }) {
  const events = deaths.slice(compact ? -5 : -8);
  if (compact) events.reverse();
  const color = id => compact ? COLORS[sides[id]] : undefined;
  return <section className={`${styles.feed} ${compact ? styles.compactFeed : ""}`} aria-label="Round kills">
    {!compact && <h2>Kill feed · {deaths.length} kills</h2>}
    {deaths.length ? events.map((e, i) => {
      const bombKill = ["c4", "planted_c4"].includes(e.weapon);
      return <p key={`${e.t}-${i}`}>
      {!compact && !bombKill && <time>{timeLabel(e.t)}</time>}
      {!bombKill && <strong style={{color: color(e.attacker)}}>{name(e.attacker)}</strong>}
      <span className={styles.killWeapon}><WeaponIcon weapon={bombKill ? "planted_c4" : e.weapon} />
        {!bombKill && e.headshot && <img src="/modifiers/icon_headshot.svg" alt="Headshot" width="13" height="13" />}
        {!bombKill && e.thrusmoke && <img src="/modifiers/smoke_kill.svg" alt="Through smoke" width="13" height="13" />}
        {!bombKill && e.penetrated > 0 && <img src="/modifiers/penetrate.svg" alt="Wallbang" width="13" height="13" />}</span>
      <strong style={{color: color(e.victim)}}>{name(e.victim)}</strong>{!compact && !bombKill && e.assister && <small>Assist: {name(e.assister)}{e.assistedflash ? " (flash)" : ""}</small>}
    </p>; }) : !compact && <p>No kills yet.</p>}
  </section>;
}

export default function RoundBankViewer({ catalog: suppliedCatalog = null, matchMode = false, onComplete, backHref = "/", teamA, teamB, seriesState, initialPlayback = null, onPlaybackChange, selectedRounds = null }) {
  const [fetchedCatalog, setCatalog] = useState(null);
  const catalog = suppliedCatalog ?? fetchedCatalog;
  const [selection, setSelection] = useState(Math.min(initialPlayback?.selection ?? 0, Math.max(0, (suppliedCatalog?.rounds.length ?? 1) - 1)));
  const [furthestSelection, setFurthestSelection] = useState(selection);
  const [loaded, setLoaded] = useState(null);
  const [error, setError] = useState("");
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(initialPlayback?.speed ?? 1);
  const speedRef = useRef(speed);
  const restoredPlayback = useRef(initialPlayback);
  const clock = useRef(null);
  const continuing = useRef(false);
  const completed = useRef(false);
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
        setPlaying(matchMode && !saved);
      }
      continuing.current = false;
      setTime(position);
      setError("");
      setLoaded({ selection, round: decoded });
    }).catch((e) => { if (e.name !== "AbortError") setError(e.message); });
    return () => controller.abort();
  }, [catalog, selection, matchMode, retry]);

  const elapsedSecond = Math.floor(time);
  useEffect(() => {
    if (round) onPlaybackChange?.({ selection, time: elapsedSecond, speed });
  }, [round, selection, elapsedSecond, speed, onPlaybackChange]);

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
          if (matchMode && !completed.current) { completed.current = true; onComplete?.(); }
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
  }, [playing, round, speed, matchMode, selection, nextSelection, catalog, onComplete]);

  const seek = (value) => { clock.current = anchorReplay(value, speed, performance.now()); setTime(value); };
  const sample = round ? sampleReplay(round, time) : null;
  const name = (id) => round?.players.find(p => p.id === id)?.name || "World";
  const deaths = sample?.events.filter((e) => e.type === "player_death") || [];
  const finished = Boolean(sample?.result);
  const progress = matchMode && round ? replayProgress(catalog.rounds, selection, round, sample) : null;

  const controls = <div className={styles.toolbar}>
    <div className={styles.controls}>
      {!matchMode && round && <ReplayRoundTimer round={round} sample={sample} />}
      <button type="button" disabled={!round} onClick={() => { if (playing) seek(Math.min(round.duration, replayTime(clock.current, performance.now()))); else seek(time >= round?.duration ? 0 : time); setPlaying(!playing); }}>{playing ? "Pause" : "Play"}</button>
      <label>Round <select value={selection} disabled={!catalog} onChange={(e) => {
        continuing.current = false; setPlaying(false); setError(""); setSelection(Number(e.target.value));
      }}>{catalog?.rounds.map((r, i) => (!selectedRounds || (selectedRounds.includes(i) && i <= furthestSelection)) && <option key={`${r.round_id}:${i}`} value={i}>Round {r.round}{!matchMode && ` · ${r.win_condition}`}</option>)}</select></label>
      {selectedRounds && <span role="status">Highlights{omittedRounds > 0 && ` · ${omittedRounds} round${omittedRounds === 1 ? "" : "s"} omitted`}</span>}
      <button type="button" disabled={!round} onClick={() => { setPlaying(false); seek(0); }}>Restart round</button>
      <label>Speed <select value={speed} onChange={(e) => { const now = performance.now(); speedRef.current = Number(e.target.value); clock.current = anchorReplay(playing ? replayTime(clock.current, now) : time, speedRef.current, now); setSpeed(speedRef.current); }}>
        {[.5, 1, 2, 4, 8].map((s) => <option key={s} value={s}>{s}×</option>)}</select></label>
      {round && <span className={styles.status} aria-live="polite">{finished ? `${round.meta.winner_side} win · ${WIN_LABELS[round.meta.win_condition] || round.meta.win_condition}` : "Round in progress"}
        {sample.bomb && ` · bomb ${sample.bomb.status}`}</span>}
      <output>{timeLabel(time)} / {timeLabel(round?.duration || 0)}</output>
    </div>
    {round && <input className={styles.seek} aria-label="Playback position" type="range" min="0" max={round.duration} step=".015625" value={time}
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
        radar={<Radar sample={sample} round={round} />}
        killfeed={<ReplayKillFeed deaths={deaths} name={name} sides={round.sides} compact />} /> : <div className={styles.match}>
        <TeamList side="T" sample={sample} round={round} /><Radar sample={sample} round={round} /><TeamList side="CT" sample={sample} round={round} />
      </div>}
      {progress && <details className={styles.stats}><summary>Match stats</summary>
        <table><thead><tr><th>Player</th><th>Team</th><th>K</th><th>D</th><th>A</th><th>Flash assists</th></tr></thead>
          <tbody>{progress.players.map((player, i) => {
            const roster = player.team === "A" ? teamA : teamB;
            const identity = roster?.players?.find(p => p.name === player.name) ?? player;
            return <tr key={i}><td><PlayerIdentity player={identity} /></td><td>{player.team === "A" ? (round.meta.macro.teamASide === "T" ? round.meta.macro.teamT : round.meta.macro.teamCT) : (round.meta.macro.teamASide === "T" ? round.meta.macro.teamCT : round.meta.macro.teamT)}</td><td>{player.kills}</td><td>{player.deaths}</td><td>{player.assists}</td><td>{player.flashAssists}</td></tr>;
          })}</tbody></table>
      </details>}
      {!matchMode && <ReplayKillFeed deaths={deaths} name={name} />}
      {!matchMode && <p className={styles.note}>Recorded round. The defuse bar uses sampled states and may differ slightly from the exact start. Utility areas are approximate.</p>}
    </>}
  </main>;
}
