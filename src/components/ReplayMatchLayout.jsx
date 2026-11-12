"use client";

import { MatchTimeline, PlayerCard } from "./CSMatchViewer";
import { mostExpensiveWeapon } from "../lib/replayEquipment.mjs";
import styles from "./ReplayMatchLayout.module.css";
import ReplayRoundTimer from "./ReplayRoundTimer";

export default function ReplayMatchLayout({ catalog, selection, round, sample, progress, teamA, teamB, seriesState, radar, killfeed, controls }) {
  const sideA = round.meta.macro.teamASide;
  const sideB = sideA === "T" ? "CT" : "T";
  const nameA = teamA?.name || (sideA === "T" ? round.meta.macro.teamT : round.meta.macro.teamCT);
  const nameB = teamB?.name || (sideA === "T" ? round.meta.macro.teamCT : round.meta.macro.teamT);
  const timeline = catalog.rounds.map((info) => ({
    tTeam: nameA, ctTeam: nameB,
    winnerName: info.winner_side === info.macro.teamASide ? nameA : nameB,
    winnerSide: info.winner_side,
    winType: { ELIMINATION: "KILL", DEFUSE: "DEFUSE", BOMB_EXPLOSION: "BOMB", TIME: "TIME" }[info.win_condition],
  }));
  const pips = (wins) => seriesState?.bestOf > 1 && <span className={styles.pips}>{Array.from({ length: seriesState.mapsToWin }, (_, i) => <i key={i} className={i < wins ? styles.won : ""} />)}</span>;
  const badge = (side) => <span className={`${styles.badge} ${side === "T" ? styles.t : styles.ct}`}><img src={`/ui/${side === "T" ? "t" : "ct"}_logo.svg`} alt={side} width="24" height="24" /></span>;
  const team = (data, name, side, right) => <div className={`${styles.teamHeading} ${right ? styles.right : ""}`}>
    {!right && badge(side)}
    {right && data?.icon && <img className={styles.logo} src={data.icon} alt="" />}
    <div><strong>{name}</strong>{data?.major && <small>{data.major}</small>}</div>
    {!right && data?.icon && <img className={styles.logo} src={data.icon} alt="" />}
    {right && badge(side)}
  </div>;
  const players = (teamId, side, right) => <section className={styles.players} aria-label={`${teamId === "A" ? nameA : nameB} players`}>
    {round.meta.assignments.filter((a) => a.team === teamId).map((assignment) => {
      const player = sample.players.find((p) => p.id === assignment.actorId);
      const stats = progress.players.find((p) => p.team === teamId && p.name === assignment.name);
      if (!player) return null;
      return <PlayerCard key={assignment.playerUid} name={assignment.name} side={side} alive={player.alive} health={player.health}
        weapon={mostExpensiveWeapon(player.inventory)} activeWeapon={player.weapon} isRight={right}
        kda={stats && { k: stats.kills, d: stats.deaths, a: stats.assists }} />;
    })}
  </section>;
  return <div className={styles.layout}>
    <div className={styles.scoreboard}>
      {team(teamA, nameA, sideA, false)}
      <div className={styles.score}>{pips(seriesState?.winsA)}<strong>{progress.score[0]}</strong><div className={styles.roundInfo}><span>Round<b>{round.meta.round}{round.meta.macro.overtime ? ` · OT ${round.meta.macro.overtime}` : " / 24"}</b></span><ReplayRoundTimer round={round} sample={sample} /></div><strong>{progress.score[1]}</strong>{pips(seriesState?.winsB)}</div>
      {team(teamB, nameB, sideB, true)}
    </div>
    <MatchTimeline rounds={timeline} currentRoundIdx={selection} isCurrentRoundFinished={Boolean(sample.result)} />
    {controls}
    <div className={styles.match}>
      {players("A", sideA, false)}
      <div className={styles.radar}>{radar}<div className={styles.killfeed}>{killfeed}</div></div>
      {players("B", sideB, true)}
    </div>
  </div>;
}
