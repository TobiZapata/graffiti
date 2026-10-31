"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { decodeReplay, sampleReplay, worldToRadar } from "../lib/roundBankReplay.mjs";
import { readReplayJSON } from "../lib/readReplayJSON.mjs";
import { replayWeaponIcon } from "../lib/replayWeaponIcon.mjs";
import { replayProgress } from "../lib/replayProgress.mjs";
import { mostExpensiveWeapon } from "../lib/replayEquipment.mjs";
import styles from "./RoundBankViewer.module.css";
import ReplayMatchLayout from "./ReplayMatchLayout";

const MAP = { originX: -3230, originY: 1713, scale: 5 };
const BASE = "/round-bank-lab";
const COLORS = { T: "#ecb458", CT: "#75cbd2" };
const timeLabel = (time) => `${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, "0")}`;

function WeaponIcon({ weapon }) {
  const [failedSource, setFailedSource] = useState(null);
  const source = replayWeaponIcon(weapon);
  if (!source || failedSource === source) return <span>{weapon || "—"}</span>;
  // SVG silhouettes are served directly and retain a text fallback if the asset fails to load.
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={styles.weaponIcon} src={source} alt={weapon} title={weapon}
    width="88" height="28" onError={() => setFailedSource(source)} />;
}

function TeamList({ side, sample, round }) {
  return <section className={styles.team} aria-label={`Jugadores ${side}`}>
    <h2 style={{ color: COLORS[side] }}>{side}{round.meta.macro && ` · ${round.meta.macro[side === "T" ? "teamT" : "teamCT"]}`}</h2>
    {round.players.filter((p) => p.side === side).map((actor) => {
      const player = sample.players.find((p) => p.id === actor.id);
      const kills = sample.events.filter((e) => e.type === "player_death" && e.attacker === actor.id &&
        round.sides[e.victim] && round.sides[e.victim] !== actor.side && !["c4", "planted_c4"].includes(e.weapon)).length;
      return <div key={actor.id} className={`${styles.player} ${!player.alive ? styles.dead : ""}`}>
        <div><strong>{actor.name}</strong><span>{kills} K · {player.alive ? `${player.health} HP` : "Eliminado"}</span></div>
        <span className={styles.playerWeapons}>{player.alive ? <>
          <span className={styles.inventoryWeapon} role="group" aria-label="Arma más cara del inventario" title="Arma más cara del inventario">
            <WeaponIcon weapon={mostExpensiveWeapon(player.inventory)} />
          </span>
          <span className={styles.activeWeapon} role="group" aria-label="Arma en mano" title="Arma en mano">
            <WeaponIcon weapon={player.weapon} />
          </span>
        </> : "—"}</span>
        {player.defuse && <label className={styles.defuse}>Desactivando
          <progress aria-label={`Desactivación de ${actor.name}`} max="1" value={player.defuse.progress} />
        </label>}
      </div>;
    })}
  </section>;
}

function Radar({ sample, round }) {
  const point = (p) => worldToRadar(p, MAP);
  return <svg className={styles.radar} viewBox="0 0 1024 1024" role="img" aria-label="Radar de Mirage con posiciones observadas">
    <image href={`${BASE}/mirage.png`} width="1024" height="1024" />
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
        <title>{actor.name}: {p.alive ? `${p.health} HP, ${p.weapon}` : "eliminado"}</title>
        {p.alive ? <><circle r="10" fill={COLORS[actor.side]} stroke="#101820" strokeWidth="2" />
          <path d="M 12 -5 L 21 0 L 12 5" fill={COLORS[actor.side]} transform={`rotate(${-p.yaw})`} /></> :
          <path d="M -6 -6 L 6 6 M 6 -6 L -6 6" stroke={COLORS[actor.side]} strokeWidth="3" />}
        <text y="-16" textAnchor="middle" fill="white" stroke="#101820" strokeWidth="3" paintOrder="stroke" fontSize="15">{actor.name}</text>
        {p.defuse && <g><image href={`${BASE}/map_defuse.svg`} x="-9" y="14" width="18" height="18" />
          <rect x="-20" y="34" width="40" height="5" fill="#101820" />
          <rect x="-20" y="34" width={40 * p.defuse.progress} height="5" fill="#86efac" /></g>}
      </g>;
    })}
    {sample.bomb && (() => { const p = point(sample.bomb); return <g transform={`translate(${p.x},${p.y})`}>
      <rect x="-8" y="-8" width="16" height="16" rx="3" fill={sample.bomb.status === "defused" ? "#86efac" : "#f87171"} stroke="#101820" strokeWidth="2" />
      <title>Bomba: {sample.bomb.status}</title>
    </g>; })()}
  </svg>;
}

function ReplayKillFeed({ deaths, name, sides = {}, compact = false }) {
  const events = deaths.slice(compact ? -5 : -8);
  if (compact) events.reverse();
  const color = id => compact ? ({T: "#dfbf63", CT: "#86a4d7"}[sides[id]]) : undefined;
  return <section className={`${styles.feed} ${compact ? styles.compactFeed : ""}`} aria-label="Bajas de la ronda">
    {!compact && <h2>Kill feed · {deaths.length} bajas</h2>}
    {deaths.length ? events.map((e, i) => <p key={`${e.t}-${i}`}>
      {!compact && <time>{timeLabel(e.t)}</time>}
      <strong style={{color: color(e.attacker)}}>{name(e.attacker)}</strong><span className={styles.killWeapon}><WeaponIcon weapon={e.weapon} />
        {e.headshot && <img src="/modifiers/icon_headshot.svg" alt="Headshot" width="13" height="13" />}
        {e.thrusmoke && <img src="/modifiers/smoke_kill.svg" alt="A través del humo" width="13" height="13" />}
        {e.penetrated > 0 && <img src="/modifiers/penetrate.svg" alt="A través de pared" width="13" height="13" />}</span>
      <strong style={{color: color(e.victim)}}>{name(e.victim)}</strong>{!compact && e.assister && <small>Asistencia: {name(e.assister)}{e.assistedflash ? " (flash)" : ""}</small>}
    </p>) : !compact && <p>Todavía no hubo bajas.</p>}
  </section>;
}

export default function RoundBankViewer({ catalog: suppliedCatalog = null, matchMode = false, onComplete, backHref = "/", teamA, teamB, seriesState, initialPlayback = null, onPlaybackChange }) {
  const [fetchedCatalog, setCatalog] = useState(null);
  const catalog = suppliedCatalog ?? fetchedCatalog;
  const [selection, setSelection] = useState(Math.min(initialPlayback?.selection ?? 0, Math.max(0, (suppliedCatalog?.rounds.length ?? 1) - 1)));
  const [loaded, setLoaded] = useState(null);
  const [error, setError] = useState("");
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(initialPlayback?.speed ?? 1);
  const restoredPlayback = useRef(initialPlayback);
  const clock = useRef(0);
  const completed = useRef(false);
  const [retry, setRetry] = useState(0);
  const round = loaded?.selection === selection ? loaded.round : null;

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
      const decoded = decodeReplay(raw, info, info.names ?? catalog.names);
      const saved = restoredPlayback.current;
      const position = saved?.selection === selection ? Math.min(saved.time, decoded.duration) : 0;
      restoredPlayback.current = null;
      clock.current = position;
      setTime(position);
      setPlaying(matchMode && !saved);
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
    let request, previous = performance.now();
    const advance = (now) => {
      clock.current = Math.min(round.duration, clock.current + (now - previous) / 1000 * speed);
      previous = now;
      setTime(clock.current);
      if (clock.current >= round.duration) {
        setPlaying(false);
        if (matchMode && selection < catalog.rounds.length - 1) setSelection(selection + 1);
        else if (matchMode && !completed.current) { completed.current = true; onComplete?.(); }
      } else request = requestAnimationFrame(advance);
    };
    request = requestAnimationFrame(advance);
    return () => cancelAnimationFrame(request);
  }, [playing, round, speed, matchMode, selection, catalog, onComplete]);

  const seek = (value) => { clock.current = value; setTime(value); };
  const sample = round ? sampleReplay(round, time) : null;
  const name = (id) => round?.players.find(p => p.id === id)?.name || "Entorno";
  const deaths = sample?.events.filter((e) => e.type === "player_death") || [];
  const finished = Boolean(sample?.result);
  const progress = matchMode && round ? replayProgress(catalog.rounds, selection, round, sample) : null;

  return <main className={`${styles.lab} ${matchMode ? styles.matchMode : ""}`}>
    {!matchMode && <header className={styles.header}><div><p>MAJOR MVP · MIRAGE</p><h1>{suppliedCatalog ? "BO1 de Mirage" : "Prueba de ronda real"}</h1>
      <span>{catalog?.source.demo.replace(/\.dem$/, "") || "Cargando banco…"}</span></div>
      <Link href={backHref}>Volver al inicio</Link></header>}
    <div className={styles.controls}>
      <label>Ronda <select value={selection} disabled={!catalog} onChange={(e) => {
        setPlaying(false); setError(""); setSelection(Number(e.target.value));
      }}>{catalog?.rounds.map((r, i) => <option key={`${r.round_id}:${i}`} value={i}>Ronda {r.round}{!matchMode && ` · ${r.win_condition}`}</option>)}</select></label>
      <button disabled={!round} onClick={() => { if (time >= round?.duration) seek(0); setPlaying(!playing); }}>{playing ? "Pausar" : "Reproducir"}</button>
      <button disabled={!round} onClick={() => { setPlaying(false); seek(0); }}>Reiniciar</button>
      <label>Velocidad <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
        {[.5, 1, 2, 4, 8].map((s) => <option key={s} value={s}>{s}×</option>)}</select></label>
      <output>{timeLabel(time)} / {timeLabel(round?.duration || 0)}</output>
    </div>
    {error && <p role="alert" className={styles.error}>{error} {catalog && <button onClick={() => { setError(""); setRetry(retry + 1); }}>Reintentar</button>}</p>}
    {!round && !error && <p role="status">Cargando ronda…</p>}
    {round && <>
      {!matchMode && round.meta.macro && <p className={styles.note}>
        {round.meta.macro.teamASide === "T" ? round.meta.macro.teamT : round.meta.macro.teamCT} {matchMode ? progress.score[0] : round.meta.macro.scoreTeam1} – {matchMode ? progress.score[1] : round.meta.macro.scoreTeam2} {round.meta.macro.teamASide === "T" ? round.meta.macro.teamCT : round.meta.macro.teamT}
        {` · ${round.meta.macro.overtime ? `OT ${round.meta.macro.overtime}` : `Mitad ${round.meta.macro.half}`}`}{!matchMode && ` · Fuente: ${round.meta.demo_id.slice(0, 8)}, ronda ${round.meta.source_round}`}
      </p>}
      <label className={styles.timeline}>Tiempo de reproducción
        <input aria-label="Tiempo de reproducción" type="range" min="0" max={round.duration} step=".015625" value={time}
          onChange={(e) => seek(Number(e.target.value))} />
      </label>
      <div className={styles.status} aria-live="polite">{finished ? `${round.meta.winner_side} gana · ${round.meta.win_condition}` : "Ronda en curso"}
        {sample.bomb && ` · Bomba: ${sample.bomb.status}`}</div>
      {matchMode ? <ReplayMatchLayout catalog={catalog} selection={selection} round={round} sample={sample}
        progress={progress} teamA={teamA} teamB={teamB} seriesState={seriesState}
        radar={<Radar sample={sample} round={round} />}
        killfeed={<ReplayKillFeed deaths={deaths} name={name} sides={round.sides} compact />} /> : <div className={styles.match}>
        <TeamList side="T" sample={sample} round={round} /><Radar sample={sample} round={round} /><TeamList side="CT" sample={sample} round={round} />
      </div>}
      {progress && <details className={styles.stats} aria-label="Estadísticas del partido"><summary>Estadísticas del partido</summary>
        <table><thead><tr><th>Jugador</th><th>Equipo</th><th>K</th><th>D</th><th>A</th><th>Flash A</th></tr></thead>
          <tbody>{progress.players.map((player, i) => <tr key={i}><td>{player.name}</td><td>{player.team === "A" ? (round.meta.macro.teamASide === "T" ? round.meta.macro.teamT : round.meta.macro.teamCT) : (round.meta.macro.teamASide === "T" ? round.meta.macro.teamCT : round.meta.macro.teamT)}</td><td>{player.kills}</td><td>{player.deaths}</td><td>{player.assists}</td><td>{player.flashAssists}</td></tr>)}</tbody></table>
      </details>}
      {!matchMode && <ReplayKillFeed deaths={deaths} name={name} />}
      {!matchMode && <p className={styles.note}>Ronda observada. El indicador de desactivación usa estados muestreados; puede diferir del comienzo exacto. Las áreas de utilidad son aproximadas.</p>}
    </>}
  </main>;
}
