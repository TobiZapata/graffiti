"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { useTournament } from "@/context/TournamentContext";
import { record } from "@/lib/majorDisplay.mjs";
import styles from "./Home.module.css";

function majorStatus({ standings, stage, swissRound, pendingResult }) {
  const me = standings.find(team => team.isPlayer);
  if (!me) return "No Major in progress";

  const phases = {
    won: "Major champions",
    eliminated: "Eliminated",
    swiss: `Swiss stage, round ${swissRound}`,
    swiss_complete: "Qualified for playoffs",
    playoffs: "Playoffs",
  };

  return `${phases[pendingResult ?? stage] ?? "Playoffs"} · ${record(me)}`;
}

function Arrow() {
  return <span aria-hidden="true" className={styles.arrow}>↗</span>;
}

function Crest({ src, alt, size, lazy = false, decorative = false }) {
  const [failedSrc, setFailedSrc] = useState(null);
  if (failedSrc === src && alt) {
    const words = alt.trim().split(/\s+/);
    const initials = words.length > 1 ? words.slice(0, 3).map(word => word[0]).join("") : alt.slice(0, 3);
    return <span className={styles.crestFallback} role={decorative ? undefined : "img"} aria-label={decorative ? undefined : alt} aria-hidden={decorative || undefined}>{initials}</span>;
  }

  /* eslint-disable-next-line @next/next/no-img-element -- Team crests come from the roster CDN or saved organizations. */
  return <img className={styles.crest} src={src} alt={decorative ? "" : alt} width={size} height={size} loading={lazy ? "lazy" : undefined} onError={alt ? () => setFailedSrc(src) : undefined} />;
}

function DraftPool({ logos }) {
  return (
    <figure className={styles.hubPool}>
      <figcaption className={styles.poolCaption}>
        <strong>Historical draft pool</strong>
      </figcaption>
      <ul className={styles.logos} aria-label="Teams in the draft pool">
        {logos.map(team => (
          <li key={team.icon} title={team.name}>
            <Crest src={team.icon} alt={team.name} size={72} lazy />
          </li>
        ))}
      </ul>
    </figure>
  );
}

function GameHub({ organization, hasActiveMajor, ready, status, careerHref, logos }) {
  const router = useRouter();
  const [showPlaybackModes, setShowPlaybackModes] = useState(false);
  const careerToggle = useRef(null);
  const careerTitleId = useId();
  const playbackModesId = useId();

  function startCareer(mode) {
    try { localStorage.setItem("major-mvp:sp-playback-mode", mode); }
    catch { /* The career is still available when storage is blocked. */ }
    setShowPlaybackModes(false);
    router.push(careerHref);
  }

  const careerCardClass = `${styles.modeCard} ${styles.careerMode}`;
  const careerLabel = <span className={styles.modeLabel}>Singleplayer</span>;

  return (
    <div className={`${styles.frame} ${styles.hub}`}>
      <section className={styles.modeGrid} aria-label="Game modes">
        {organization && !hasActiveMajor ? <div className={careerCardClass} onKeyDown={event => {
          if (event.key === "Escape" && showPlaybackModes) {
            setShowPlaybackModes(false);
            careerToggle.current?.focus();
          }
        }}>
          <button ref={careerToggle} type="button" className={styles.careerToggle}
            aria-labelledby={careerTitleId} aria-expanded={showPlaybackModes} aria-controls={playbackModesId}
            aria-busy={!ready} disabled={!ready} onClick={() => setShowPlaybackModes(open => !open)} />
          {careerLabel}
          <div className={styles.modeDetails}>
            <h2 id={careerTitleId}>Major Career</h2>
            <p>{status}</p>
            <div id={playbackModesId} className={styles.careerActions} hidden={!showPlaybackModes}>
              <button type="button" onClick={() => startCareer("highlights")}>Highlights</button>
              <button type="button" onClick={() => startCareer("full")}>Full match</button>
            </div>
          </div>
          {!showPlaybackModes && <Arrow />}
        </div> : <Link prefetch={false} href={careerHref} aria-busy={!ready} className={careerCardClass}>
          {careerLabel}
          <div className={styles.modeDetails}>
            <h2>Major Career</h2>
            <p>{status ?? "Draft a roster and play the Major."}</p>
          </div>
          <Arrow />
        </Link>}
        <Link prefetch={false} href="/multiplayer" className={`${styles.modeCard} ${styles.roomMode}`}>
          <span className={styles.modeLabel}>Play with friends</span>
          <div className={styles.modeDetails}>
            <h2>Multiplayer Room</h2>
            <p>Create or join a room.</p>
          </div>
          <Arrow />
        </Link>
      </section>
      <ol className={styles.steps} aria-label="How it works">
        <li><span>01</span><div><strong>Draft your 5</strong><p>Build a roster from historic Major teams.</p></div></li>
        <li><span>02</span><div><strong>Map veto</strong><p>Ban and pick maps before each BO1, BO3 or BO5.</p></div></li>
        <li><span>03</span><div><strong>Watch live</strong><p>Follow every round on the 2D tactical radar.</p></div></li>
      </ol>
      <footer>
        <DraftPool logos={logos.slice(0, 8)} />
      </footer>
    </div>
  );
}

export default function Home({ logos }) {
  const tournament = useTournament();
  const { organization, ready, stage, pendingResult, standings } = tournament;
  const activeOrganization = ready ? organization : null;
  const hasActiveMajor = Boolean(activeOrganization && standings.some(team => team.isPlayer)
    && !["won", "eliminated"].includes(pendingResult ?? stage));
  const careerHref = hasActiveMajor ? "/simulation" : activeOrganization ? "/organization" : "/play";

  return (
    <>
      <header className={styles.frame + " " + styles.header}>
        <h1 className={styles.wordmark}>CS Major Simulator</h1>
        {activeOrganization && (
          <Link prefetch={false} href="/organization" className={styles.headerOrg}
            aria-label={"My Organization: " + activeOrganization.name}>
            <Crest src={activeOrganization.icon} alt={activeOrganization.name} size={24} decorative />
            <span>{activeOrganization.name}</span>
          </Link>
        )}
      </header>
      <main className={styles.main}>
        <GameHub organization={activeOrganization} hasActiveMajor={hasActiveMajor} ready={ready}
          status={activeOrganization ? majorStatus(tournament) : null}
          careerHref={careerHref} logos={logos} />
      </main>
    </>
  );
}
