"use client";

import { useState } from "react";
import teams from "@/data/teams.json";
import Link from "next/link";
import SpinScreen from "@/components/play/SpinScreen";
import TeamSelection from "@/components/play/TeamSelection";
import TeamDetails from "@/components/play/TeamDetails";
import SquadPanel from "@/components/play/SquadPanel";
import RoleSelectionModal from "@/components/play/RoleSelectionModal";

export default function PlayPage() {
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
    <main className="min-h-screen bg-neutral-950 p-8 text-white">
      <h1 className="mb-8 text-center text-4xl font-bold">
        ROUND{" "}
        {Math.min(squad.length + 1, 5)}{" "}
        / 5
      </h1>

      <div className="mx-auto flex max-w-7xl gap-8">
        <section className="flex-1">
          {draftCompleted ?
            <div className="flex h-150 items-center justify-center">
              <Link
                href="/simulation"
                className="rounded-xl bg-green-600 px-12 py-6 text-3xl font-bold hover:bg-green-700"
              >
                START MAJOR
              </Link>
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
