"use client";

import Image from "next/image";
import Link from "next/link";
import { REPLAY_MAPS } from "@/lib/replayMaps.mjs";
import { vetoStatus } from "@/lib/mapVeto.mjs";
import styles from "./MapVeto.module.css";

export default function MapVeto({ veto, match, playerTeam, onChoose, onStart, backHref }) {
  const status = vetoStatus(veto);
  const teamName = team => (team === "A" ? match.teamA : match.teamB).name;
  return <main className={styles.page}>
    <header className={styles.header}>
      <Link href={backHref} className="link">Back to the Major</Link>
      <span>Major-MVP · BO{veto.bestOf}</span>
    </header>
    <div className={styles.title}>
      <div><h1>Map veto</h1>
        <p>{match.teamA.name} <span>vs</span> {match.teamB.name}</p></div>
      {status.done && <button type="button" className="btn btn-primary" onClick={onStart}>Start match</button>}
    </div>
    <div className={styles.layout}>
      <section aria-label="Map pool">
        <p className={styles.turn} role="status">{status.done ? "Veto complete" : `Your turn · ${status.action === "ban" ? "Ban" : "Pick"} a map`}</p>
        <ul className={styles.pool}>
          {Object.entries(REPLAY_MAPS).map(([id, map]) => {
            const action = veto.actions.find(item => item.map === id);
            const order = status.maps.indexOf(id);
            const available = status.remaining.includes(id) && !status.done;
            const folder = id === "de_dust2" ? "dust" : id.slice(3);
            return <li key={id} className={action?.action === "ban" ? styles.banned : ""}>
              <Image src={`/maps/${folder}/map_icon_${id}.svg`} alt="" width={40} height={40} unoptimized />
              <strong>{map.label}</strong>
              <span className={styles.result}>{action ? `${action.action === "ban" ? "Banned" : "Picked"} by ${teamName(action.team)}` : status.done ? "Decider" : "Available"}</span>
              {available ? <button type="button" className="btn btn-secondary" disabled={status.turn !== playerTeam}
                aria-label={`${status.action === "ban" ? "Ban" : "Pick"} ${map.label}`} onClick={() => onChoose(id)}>{status.action === "ban" ? "Ban" : "Pick"}</button>
                : <span className={styles.order}>{order >= 0 ? `Map ${order + 1}` : "Banned"}</span>}
            </li>;
          })}
        </ul>
      </section>
      <aside className={styles.history}>
        <h2>{status.done ? "Series maps" : "Veto history"}</h2>
        {status.done ? <ol className={styles.series}>{status.maps.map((id, i) => <li key={id}>
          <span>Map {i + 1}</span><strong>{REPLAY_MAPS[id].label}</strong>
          <span>{i === status.maps.length - 1 ? "Decider" : "Pick"}</span>
        </li>)}</ol> : <p className={styles.hint}>You choose for {teamName(playerTeam)}. The opponent responds automatically.</p>}
        {veto.actions.length > 0 && <ol className={styles.actions} aria-label="Veto actions">{veto.actions.map((action, i) => <li key={action.map}>
          <span>{i + 1}. {teamName(action.team)}</span>
          <span>{action.action === "ban" ? "Bans" : "Picks"} <strong>{REPLAY_MAPS[action.map].label}</strong></span>
        </li>)}</ol>}
      </aside>
    </div>
  </main>;
}
