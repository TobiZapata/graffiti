"use client";
import { playerOptionLabel } from "@/lib/playerCountry.mjs";
import PlayerIdentity from "@/components/PlayerIdentity";

import { useRef, useState } from "react";
import Link from "next/link";
import { useTournament } from "@/context/TournamentContext";
import { fazePlayersConfig } from "@/data/faze";
import { spiritPlayersConfig } from "@/data/spirit";
import { assembleMirageBO1 } from "@/lib/assembleMirageBO1.mjs";
import { retryReplayAssembly } from "@/lib/retryReplayAssembly.mjs";
import { readReplayJSON } from "@/lib/readReplayJSON.mjs";
import { attachRoundResolutions } from "@/lib/replayResolution.mjs";
import { REPLAY_MAPS } from "@/lib/replayMaps.mjs";
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
  const [map, setMap] = useState('de_mirage');
  const [match, setMatch] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const bank = useRef({});
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
      bank.current[map] ??= attachRoundResolutions(await readReplayJSON(REPLAY_MAPS[map].bank),
        await readReplayJSON(REPLAY_MAPS[map].resolution));
      const result = await retryReplayAssembly(assemblySeed => assembleMirageBO1(bank.current[map],
        { ...teamA, mainAwperUid: selectedA.mainAwperUid, iglUid: selectedA.iglUid },
        { ...teamB, mainAwperUid: selectedB.mainAwperUid, iglUid: selectedB.iglUid }, seed, assemblySeed, 3, map), seed);
      setMatch({ ...result, teamA, teamB, key: ++generation.current });
    } catch (e) {
      setError(e.message);
    } finally { setBusy(false); }
  }

  return <>
    <section className={styles.lab} aria-label="Generate a BO1">
      <header className={styles.header}><div><h1>BO1 assembler</h1>
        <p>BO1 · MR12 · Overtime MR3</p></div><Link href="/replay-lab">View the recorded rounds</Link></header>
      <form className={styles.controls} onSubmit={generate}>
        <label>Map <select disabled={busy} value={map} onChange={e => setMap(e.target.value)}>
          {Object.entries(REPLAY_MAPS).map(([id, item]) => <option key={id} value={id}>{item.label}</option>)}
        </select></label>
        <label>Team A <select disabled={busy} value={teams[teamAIndex] ? teamAIndex : 0} onChange={e => setTeamAIndex(Number(e.target.value))}>
          {teams.map((team, i) => <option key={team.id} value={i}>{team.name}</option>)}
        </select></label>
        <label>Team B <select disabled={busy} value={teams[teamBIndex] ? teamBIndex : 0} onChange={e => setTeamBIndex(Number(e.target.value))}>
          {teams.map((team, i) => <option key={team.id} value={i}>{team.name}</option>)}
        </select></label>
        {[["A", teamA, selectedA, setRolesA], ["B", teamB, selectedB, setRolesB]].map(([side, team, roles, setRoles]) =>
          [["mainAwperUid", "Main AWPer"], ["iglUid", "IGL"]].map(([field, label]) =>
            <label key={side + field}>{label} equipo {side} <select required disabled={busy} value={roles[field]}
              onChange={e => setRoles({ ...roles, teamId: team.id, [field]: e.target.value })}>
              <option value="">Choose a player</option>
              {team.players.map((player, index) => <option key={String(player.uid ?? index)} value={String(player.uid ?? index)}>{playerOptionLabel(player)}</option>)}
            </select></label>))}
        <label>Seed <input disabled={busy} required value={seed} onChange={e => setSeed(e.target.value)} /></label>
        <button disabled={busy} type="submit">{busy ? "Assembling…" : "Generate BO1"}</button>
      </form>
      <p className={styles.note}>The winner is chosen first, then recorded rounds are assigned using Firepower and seeded player form, without kill quotas. Buys respect saved weapons and the available money; weapons show the skin chosen by the engine.</p>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {match && <>
        <p>{match.catalog.rounds.length} rounds · seed {String(match.seed)}</p>
        <details><summary>BO1 stats</summary>
          <table><thead><tr><th scope="col">Player</th><th scope="col">Team</th><th scope="col">K</th><th scope="col">D</th><th scope="col">A</th><th scope="col">Flash A</th></tr></thead>
            <tbody>{match.playerStats.map(p => <tr key={p.uid}><th scope="row"><PlayerIdentity player={(p.uid.startsWith("A:") ? match.teamA : match.teamB).players.find(player => player.uid === p.uid.slice(2)) ?? p} /></th><td>{p.team}</td><td>{p.kills}</td><td>{p.deaths}</td><td>{p.assists}</td><td>{p.flashAssists}</td></tr>)}</tbody>
          </table>
        </details>
      </>}
    </section>
    {match && <RoundBankViewer key={match.key} catalog={match.catalog} teamA={match.teamA} teamB={match.teamB} />}
  </>;
}
