"use client";

import { useState } from "react";
import teams from "@/data/teams.json";
import Link from "next/link";
import SpinScreen from "@/components/play/SpinScreen";
import TeamSelection from "@/components/play/TeamSelection";
import TeamDetails from "@/components/play/TeamDetails";
import SquadPanel from "@/components/play/SquadPanel";
import RoleSelectionModal from "@/components/play/RoleSelectionModal";
import { useRouter } from "next/navigation";
import { useTournament } from "@/context/TournamentContext";

export default function PlayPage() {
  const router = useRouter();
  const { initTournament } = useTournament();
  const [rolledTeams, setRolledTeams] =
    useState([]);

  const [
    selectedTeam,
    setSelectedTeam,
  ] = useState(null);

  const [
    selectedPlayer,
    setSelectedPlayer,
  ] = useState(null);

  const [squad, setSquad] = useState(
    [],
  );

  const [teamName, setTeamName] = useState("");

  const spin = () => {
    const newTeams = [...teams]
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);

    setSelectedTeam(null);
    setRolledTeams(newTeams);
  };

  const handleRoleSelection = (
    role,
  ) => {
    if (!selectedPlayer) return;

    setSquad((prev) => [
      ...prev,
      {
        player: selectedPlayer,
        assignedRole: role,
      },
    ]);

    setSelectedPlayer(null);

    setSelectedTeam(null);

    setRolledTeams([]);
  };

  const draftCompleted =
    squad.length >= 5;

  return (
    <main className="min-h-screen p-8 text-white">
      <h1 className="mb-8 text-center text-4xl font-bold">
        ROUND{" "}
        {Math.min(squad.length + 1, 5)}{" "}
        / 5
      </h1>

      <div className="mx-auto flex max-w-7xl gap-8">
        <section className="flex-1">
          {draftCompleted ?
            <div className="flex h-150 flex-col items-center justify-center gap-6">
              <div className="w-full max-w-md">
                <label className="block text-sm font-bold text-neutral-400 mb-2 uppercase tracking-wider">Team Name</label>
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="Enter your team name..."
                  maxLength={20}
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-lg text-white placeholder-neutral-600 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 transition-colors"
                />
              </div>
              <button
                onClick={() => {
                  initTournament(squad, teamName.trim() || "My Team");
                  router.push("/simulation");
                }}
                className="rounded-xl bg-green-600 px-12 py-6 text-3xl font-bold hover:bg-green-700 transition-colors"
              >
                START MAJOR
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
            />
          : <TeamDetails
              team={selectedTeam}
              squad={squad}
              onSelectPlayer={
                setSelectedPlayer
              }
            />
          }
        </section>

        <SquadPanel squad={squad} />
      </div>

      <RoleSelectionModal
        player={selectedPlayer}
        onClose={() =>
          setSelectedPlayer(null)
        }
        onSelectRole={
          handleRoleSelection
        }
      />
    </main>
  );
}
