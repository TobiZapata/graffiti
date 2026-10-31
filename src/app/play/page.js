"use client";

import { useState } from "react";
import teams from "@/data/teams.json";
import SpinScreen from "@/components/play/SpinScreen";
import TeamSelection from "@/components/play/TeamSelection";
import TeamDetails from "@/components/play/TeamDetails";
import SquadPanel from "@/components/play/SquadPanel";
import LogoCreator from "@/components/play/LogoCreator";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTournament } from "@/context/TournamentContext";

export default function PlayPage() {
  const router = useRouter();
  const { organization, ready, storageError, createOrganization } = useTournament();
  const [rolledTeams, setRolledTeams] =
    useState([]);

  const [
    selectedTeam,
    setSelectedTeam,
  ] = useState(null);

  const [squad, setSquad] = useState(
    [],
  );

  const [mainAwperUid, setMainAwperUid] = useState("");
  const [iglUid, setIglUid] = useState("");
  const [starUid, setStarUid] = useState("");
  const [teamName, setTeamName] = useState("");
  const [teamIcon, setTeamIcon] = useState("");
  const [colors, setColors] = useState(["#1e293b", "#38bdf8"]);
  const [error, setError] = useState("");
  const [rerollsLeft, setRerollsLeft] = useState(3);

  const spin = () => {
    const newTeams = [...teams]
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);

    setSelectedTeam(null);
    setRolledTeams(newTeams);
  };

  const reroll = () => {
    if (rerollsLeft > 0) {
      setRerollsLeft(prev => prev - 1);
      spin();
    }
  };

  const handlePlayerSelection = (player) => {
    setSquad((prev) => [...prev, { player }]);
    setSelectedTeam(null);

    setRolledTeams([]);
  };

  const draftCompleted =
    squad.length >= 5;

  if (!ready) return <main className="p-8 text-white">Cargando organización...</main>;
  if (storageError) return <main className="p-8 text-red-400" role="alert">{storageError}</main>;
  if (organization) return <main className="p-8 text-white">Ya tienes una organización. <Link className="text-amber-500 underline" href="/organization">Ir al hub</Link></main>;

  return (
    <main className="min-h-screen p-8 text-white">
      <h1 className="mb-8 text-center text-4xl font-bold">
        ROUND{" "}
        {Math.min(squad.length + 1, 5)}{" "}
        / 5
      </h1>

      <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row">
        {/* Main Content Area */}
        <div className="flex-1">
          {draftCompleted ?
            <div className="flex h-full flex-col items-center justify-center space-y-8">
              <h2 className="text-5xl font-bold text-amber-500">
                SQUAD COMPLETE!
              </h2>
              <div className="w-full max-w-md">
                <label htmlFor="team-name" className="block text-sm font-bold text-neutral-400 mb-2 uppercase tracking-wider">Nombre de la organización</label>
                <input
                  id="team-name"
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="Enter your team name..."
                  maxLength={20}
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-lg text-white placeholder-neutral-600 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 transition-colors"
                />
              </div>
              
              <div className="w-full max-w-md">
                <LogoCreator onChange={setTeamIcon} onColorsChange={setColors} />
              </div>

              {[["Main AWPer", mainAwperUid, setMainAwperUid], ["IGL", iglUid, setIglUid], ["STAR", starUid, setStarUid]].map(([label, value, setValue]) => (
                <label key={label} className="w-full max-w-md text-sm font-bold text-neutral-400">
                  {label}
                  <select required value={value} onChange={e => setValue(e.target.value)} className="mt-2 w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-white">
                    <option value="">Choose a player</option>
                    {squad.map((entry, index) => <option key={index} value={String(index)}>{entry.player.name}</option>)}
                  </select>
                </label>
              ))}
              {mainAwperUid && mainAwperUid === iglUid && <p role="alert" className="text-red-400">Choose different players for AWPer and IGL.</p>}
              {error && <p role="alert" className="text-red-400">{error}</p>}
              <button
                disabled={!teamName.trim() || !teamIcon || !mainAwperUid || !iglUid || !starUid || mainAwperUid === iglUid}
                onClick={() => {
                  try {
                    const result = createOrganization({ name: teamName.trim(), icon: teamIcon, colors, squad, mainAwperUid, iglUid, starUid });
                    if (result === false) throw new Error();
                    router.push("/organization");
                  } catch {
                    setError("No se pudo crear la organización. Revisa los datos e inténtalo de nuevo.");
                  }
                }}
                className="rounded-xl bg-amber-600 px-12 py-6 text-2xl font-bold hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
              >
                Crear organización
              </button>
            </div>
          : rolledTeams.length === 0 ?
            <SpinScreen onSpin={spin} />
          : !selectedTeam ?
            <TeamSelection
              teams={rolledTeams}
              onSelectTeam={
                setSelectedTeam
              }
              onReroll={rerollsLeft > 0 ? reroll : null}
              rerollsLeft={rerollsLeft}
            />
          : <TeamDetails
              team={selectedTeam}
              squad={squad}
              onSelectPlayer={
                handlePlayerSelection
              }
              onBack={() => setSelectedTeam(null)}
            />
          }
        </div>

        <SquadPanel squad={squad} />
      </div>

    </main>
  );
}
