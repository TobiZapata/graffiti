"use client";

import { Fragment, useEffect, useEffectEvent, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { REPLAY_MAPS } from "@/lib/replayMaps.mjs";
import { vetoStatus } from "@/lib/mapVeto.mjs";
import { playVetoAction, playMatchStart } from "@/lib/soundEffects.mjs";
import styles from "./MapVeto.module.css";

const mapArt = {
  de_mirage: ["mapveto_mirage_color_tga_66e9442c.png", "mapveto_mirage_bw_color_tga_618889ba.png"],
  de_dust2: ["mapveto_dust2_color_tga_873b4e4.png", "mapveto_dust2_bw_color_tga_8c8050e3.png"],
  de_nuke: ["mapveto_nuke_color_tga_34b7a4d5.png", "mapveto_nuke_bw_color_tga_9d040e74.png"],
  de_anubis: ["mapveto_anubis_color.png", "mapveto_anubis_bw.png"],
  de_cache: ["mapveto_cache_color.png", "mapveto_cache_bw.png"],
  de_inferno: ["mapveto_inferno_color_tga_de864204.png", "mapveto_inferno_bw_color_tga_8af7db15.png"],
  de_ancient: ["mapveto_ancient_color.png", "mapveto_ancient_bw.png"],
};

export function mapArtPath(map, banned = false) {
  return `/picksbans/${mapArt[map][banned ? 1 : 0]}`;
}

function TurnTimer({ deadline }) {
  const [seconds, setSeconds] = useState(null);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSeconds(remaining);
      if (remaining === 0) window.clearInterval(interval);
    }, 100);
    return () => window.clearInterval(interval);
  }, [deadline]);

  const time = seconds === null
    ? "--:--"
    : [Math.floor(seconds / 60), seconds % 60].map(value => String(value).padStart(2, "0")).join(":");

  return (
    <div className={styles.timer} role="timer" data-expiring={seconds !== null && seconds <= 10}>
      <span>Time left</span>
      <strong>{time}</strong>
    </div>
  );
}

function StartCountdown({ onStart }) {
  const [seconds, setSeconds] = useState(4);
  const started = useRef(false);
  const startMatch = useEffectEvent(onStart);

  useEffect(() => {
    const deadline = Date.now() + 4000;
    const interval = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSeconds(remaining);
      if (remaining > 0) return;

      window.clearInterval(interval);
      if (started.current) return;
      started.current = true;
      playMatchStart();
      startMatch();
    }, 100);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <p className={styles.countdown} role="timer">
      {seconds > 0 ? `Starting match in ${seconds}s` : "Starting match…"}
    </p>
  );
}

export default function MapVeto({
  veto,
  match,
  playerTeam,
  onChoose,
  onStart,
  backHref,
  isPvp = false,
  turnDeadlineMs = null,
  busy = false,
  error = "",
  opponentAbandoned = false,
}) {
  const { actions } = veto;
  const previousActionCount = useRef(actions.length);

  useEffect(() => {
    const previousCount = previousActionCount.current;
    previousActionCount.current = actions.length;
    if (actions.length > previousCount) playVetoAction(actions.at(-1).action);
  }, [actions]);

  const status = vetoStatus(veto);
  const teamName = team => (team === "A" ? match.teamA : match.teamB).name;
  const opponent = teamName(playerTeam === "A" ? "B" : "A");
  const yourTurn = !status.done && status.turn === playerTeam;
  const actionLabel = status.action === "ban" ? "Ban" : "Pick";
  const turnLabel = opponentAbandoned ? "Opponent abandoned"
    : status.done ? "Veto complete"
    : yourTurn ? `Your turn · ${actionLabel} a map`
    : `Waiting for ${opponent}…`;

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroTop}>
          <Link href={backHref} className={styles.back}>
            <span aria-hidden="true">←</span> {match?.round === "Single match" ? "Back to lobby" : "Back to the Major"}
          </Link>
          <div className={styles.format}>
            <strong>BO{veto.bestOf}</strong>
            <span data-live={isPvp}>{isPvp ? "Live PvP" : "vs NPC"}</span>
          </div>
        </div>
        <div className={styles.matchup}>
          <h1>Picks &amp; Bans</h1>
          <div className={styles.teams}>
            {[["A", match.teamA], ["B", match.teamB]].map(([team, info]) => (
              <Fragment key={team}>
                <div className={styles.team} data-team={team}>
                  {info.icon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className={styles.teamMark} src={info.icon} alt="" width={64} height={64} />
                  ) : (
                    <span className={styles.teamMark} aria-hidden="true">{info.name.slice(0, 3)}</span>
                  )}
                  <div className={styles.teamLabel}>
                    <strong>{info.name}</strong>
                  </div>
                </div>
                {team === "A" && <span className={styles.versus}>vs</span>}
              </Fragment>
            ))}
          </div>
        </div>
        <div className={styles.turnBar}>
          <p role="status" className={styles.turn} data-active={yourTurn && !opponentAbandoned}>
            {turnLabel}
          </p>
          {turnDeadlineMs != null && !status.done && <TurnTimer key={turnDeadlineMs} deadline={turnDeadlineMs} />}
          {status.done && !opponentAbandoned && (
            <StartCountdown onStart={onStart} />
          )}
        </div>
      </header>

      {opponentAbandoned && (
        <p className={styles.notice} role="status"><strong>{opponent} abandoned the match.</strong> You advance automatically.</p>
      )}
      {error && <p className={styles.error} role="alert">{error}</p>}

      <section className={styles.section} aria-labelledby="veto-map-pool">
        <div className={styles.sectionHead}>
          <h2 id="veto-map-pool">Map pool</h2>
          {!status.done && <span>{status.remaining.length} available</span>}
        </div>
        <ul className={styles.pool} role="list">
          {Object.entries(REPLAY_MAPS).map(([id, map]) => {
            const action = veto.actions.find(item => item.map === id);
            const order = status.maps.indexOf(id) + 1;
            const banned = action?.action === "ban";
            const decider = status.done && !action;
            const available = !action && !status.done;
            const canChoose = available && yourTurn && !opponentAbandoned;
            const state = banned ? "banned" : decider ? "decider" : available ? "available" : "picked";
            const label = banned ? "Banned" : decider ? `Decider · Map ${order}`
              : available ? "Available" : `Picked · Map ${order}`;
            const folder = id === "de_dust2" ? "dust" : id.slice(3);

            return (
              <li key={id} className={styles.map} data-state={state}>
                <div className={styles.mapScene}>
                  <Image
                    className={styles.mapArt}
                    src={mapArtPath(id, banned)}
                    alt=""
                    fill
                    sizes="(max-width: 600px) 50vw, (max-width: 1080px) 25vw, (max-width: 1440px) 14vw, 196px"
                  />
                  <span className={styles.badge}>{label}</span>
                  <Image className={styles.mapIcon} src={`/maps/${folder}/map_icon_${id}.svg`} alt="" width={38} height={38} unoptimized />
                </div>
                <div className={styles.mapInfo}>
                  <h3>{map.label}</h3>
                  {action && <p className={styles.mapTeam} data-team={action.team}>{teamName(action.team)}</p>}
                  {canChoose && (
                    <button type="button" className={styles.choose} disabled={busy}
                      aria-label={`${actionLabel} ${map.label}`} onClick={() => onChoose(id)}>
                      {actionLabel} {map.label}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {status.done && (
        <section className={styles.section} aria-labelledby="veto-series-maps">
          <div className={styles.sectionHead}><h2 id="veto-series-maps">Series maps</h2></div>
          <ol className={styles.series} role="list">
            {status.maps.map((id, index) => {
              const decider = index === status.maps.length - 1;
              return (
                <li key={id} data-decider={decider}>
                  <span>Map {index + 1}</span>
                  <strong>{REPLAY_MAPS[id].label}</strong>
                  <span>{decider ? "Decider" : "Pick"}</span>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <section className={styles.section} aria-labelledby="veto-history">
        <div className={styles.sectionHead}>
          <h2 id="veto-history">Veto history</h2>
          <span>{veto.actions.length} / {Object.keys(REPLAY_MAPS).length - 1} actions</span>
        </div>
        {veto.actions.length === 0 ? <p className={styles.empty}>The first veto action will appear here.</p> : (
          <ol className={styles.history} role="list">
            {veto.actions.map((action, index) => (
              <li key={action.map}>
                <span className={styles.step} aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                <span className={styles.historyTeam} data-team={action.team}>{teamName(action.team)}</span>
                <span className={styles.historyAction} data-action={action.action}>{action.action}</span>
                <strong>{REPLAY_MAPS[action.map].label}</strong>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
