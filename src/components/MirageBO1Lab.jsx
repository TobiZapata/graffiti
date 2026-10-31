"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useTournament } from "@/context/TournamentContext";
import { fazePlayersConfig } from "@/data/faze";
import { spiritPlayersConfig } from "@/data/spirit";
import { assembleMirageBO1 } from "@/lib/assembleMirageBO1.mjs";
import { retryReplayAssembly } from "@/lib/retryReplayAssembly.mjs";
import { readReplayJSON } from "@/lib/readReplayJSON.mjs";
import RoundBankViewer from "./RoundBankViewer";
import styles from "./RoundBankViewer.module.css";

const REFERENCE_TEAMS = [
  { id: "faze-lab", name: "FaZe", players: fazePlayersConfig },
  { id: "spirit-lab", name: "Spirit", players: spiritPlayersConfig },
];

export default function MirageBO1Lab() {
  const { mySquad, teamName } = useTournament();
  const teams = (mySquad.length === 5 ? [...REFERENCE_TEAMS, {
    id: "draft-lab", name: teamName,
    players: mySquad.map(s => ({ ...s.player, role: s.assignedRole?.toUpperCase() ?? s.player.role })),
  }] : REFERENCE_TEAMS).map(team => ({ ...team, players: team.players.map((player, index) => ({
    ...player, uid: String(player.uid ?? player.id ?? index),
  })) }));
  const [teamAIndex, setTeamAIndex] = useState(0);
  const [teamBIndex, setTeamBIndex] = useState(1);
  const [rolesA, setRolesA] = useState({});
  const [rolesB, setRolesB] = useState({});
  const [seed, setSeed] = useState("mirage-bo1");
  const [match, setMatch] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const bank = useRef(null);
  const generation = useRef(0);

  const teamA = teams[teamAIndex] ?? teams[0];
  const teamB = teams[teamBIndex] ?? teams[0];
  const validRoles = (team, roles) => {
    const ids = team.players.map((player, index) => String(player.uid ?? index));
    const roster = team.players.map(player => `${player.uid}:${player.name}`).join('|');
    return {
      roster,
      mainAwperUid: roles.teamId === team.id && roles.roster === roster && ids.includes(roles.mainAwperUid) ? roles.mainAwperUid : "",
      iglUid: roles.teamId === team.id && roles.roster === roster && ids.includes(roles.iglUid) ? roles.iglUid : "",
    };
  };
  const selectedA = validRoles(teamA, rolesA);
  const selectedB = validRoles(teamB, rolesB);

  async function generate(event) {
    event.preventDefault();
    setError(""); setBusy(true); setMatch(null);
    try {
      bank.current ??= await readReplayJSON("/round-bank/economy-index.json");
      const result = await retryReplayAssembly(assemblySeed => assembleMirageBO1(bank.current,
        { ...teamA, mainAwperUid: selectedA.mainAwperUid, iglUid: selectedA.iglUid },
        { ...teamB, mainAwperUid: selectedB.mainAwperUid, iglUid: selectedB.iglUid }, seed, assemblySeed), seed);
      setMatch({ ...result, key: ++generation.current });
    } catch (e) {
      setError(e.message);
    } finally { setBusy(false); }
  }

  return <>
    <section className={styles.lab} aria-label="Generar BO1 de Mirage">
      <header className={styles.header}><div><h1>Ensamblador de Mirage</h1>
        <p>BO1 · MR12 · Overtime MR3</p></div><Link href="/replay-lab">Ver rondas originales</Link></header>
      <form className={styles.controls} onSubmit={generate}>
        <label>Equipo A <select disabled={busy} value={teams[teamAIndex] ? teamAIndex : 0} onChange={e => setTeamAIndex(Number(e.target.value))}>
          {teams.map((team, i) => <option key={team.id} value={i}>{team.name}</option>)}
        </select></label>
        <label>Equipo B <select disabled={busy} value={teams[teamBIndex] ? teamBIndex : 0} onChange={e => setTeamBIndex(Number(e.target.value))}>
          {teams.map((team, i) => <option key={team.id} value={i}>{team.name}</option>)}
        </select></label>
        {[["A", teamA, selectedA, setRolesA], ["B", teamB, selectedB, setRolesB]].map(([side, team, roles, setRoles]) =>
          [["mainAwperUid", "Main AWPer"], ["iglUid", "IGL"]].map(([field, label]) =>
            <label key={side + field}>{label} equipo {side} <select required disabled={busy} value={roles[field]}
              onChange={e => setRoles({ ...roles, teamId: team.id, [field]: e.target.value })}>
              <option value="">Elegir jugador</option>
              {team.players.map((player, index) => <option key={String(player.uid ?? index)} value={String(player.uid ?? index)}>{player.name}</option>)}
            </select></label>))}
        <label>Semilla <input disabled={busy} required value={seed} onChange={e => setSeed(e.target.value)} /></label>
        <button disabled={busy} type="submit">{busy ? "Ensamblando…" : "Generar BO1"}</button>
      </form>
      <p className={styles.note}>El ganador se elige de antemano y las rondas observadas se ensamblan con objetivos de kills flexibles. Las compras internas respetan lo conservado y el presupuesto disponible; las armas se muestran con la apariencia elegida por el motor.</p>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {match && <>
        <p>{match.catalog.rounds.length} rondas · Semilla: {String(match.seed)}</p>
        <details><summary>Estadísticas del BO1</summary>
          <table><thead><tr><th scope="col">Jugador</th><th scope="col">Equipo</th><th scope="col">K</th><th scope="col">K objetivo</th><th scope="col">Diferencia</th><th scope="col">D</th><th scope="col">A</th><th scope="col">Flash A</th></tr></thead>
            <tbody>{match.playerStats.map(p => <tr key={p.uid}><th scope="row">{p.name}</th><td>{p.team}</td><td>{p.kills}</td><td>{p.targetKills}</td><td>{p.killDeviation}</td><td>{p.deaths}</td><td>{p.assists}</td><td>{p.flashAssists}</td></tr>)}</tbody>
          </table>
        </details>
      </>}
    </section>
    {match && <RoundBankViewer key={match.key} catalog={match.catalog} />}
  </>;
}
