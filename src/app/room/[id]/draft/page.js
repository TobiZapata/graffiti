"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getTeamsFromDB } from "@/lib/teamService";
import { submitDraft } from "@/lib/roomService";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import SpinScreen from "@/components/play/SpinScreen";
import TeamSelection from "@/components/play/TeamSelection";
import TeamDetails from "@/components/play/TeamDetails";
import SquadPanel from "@/components/play/SquadPanel";
import RoleSelectionModal from "@/components/play/RoleSelectionModal";
import LogoCreator from "@/components/play/LogoCreator";

export default function MultiplayerDraftPage({ params }) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const roomId = use(params).id;

  const [teams, setTeams] = useState([]);
  const [room, setRoom] = useState(null);
  const [rolledTeams, setRolledTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [squad, setSquad] = useState([]);
  const [teamName, setTeamName] = useState("");
  const [teamIcon, setTeamIcon] = useState("");
  const [rerollsLeft, setRerollsLeft] = useState(3);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    getTeamsFromDB().then(data => setTeams(data));
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/multiplayer");
      return;
    }

    const roomRef = doc(db, "rooms", roomId);
    const unsubscribe = onSnapshot(roomRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setRoom(data);
        
        // Check if user already submitted
        const me = data.players?.find(p => p.uid === user.uid);
        if (me?.isReady) setSubmitted(true);

        if (data.status === "playing") {
          router.push(`/room/${roomId}/simulation`);
        }
      }
    });

    return () => unsubscribe();
  }, [roomId, user, loading, router]);

  const spin = () => {
    if (teams.length === 0) return;
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

  const handleRoleSelection = (role) => {
    if (!selectedPlayer) return;
    setSquad((prev) => [...prev, { player: selectedPlayer, assignedRole: role }]);
    setSelectedPlayer(null);
    setSelectedTeam(null);
    setRolledTeams([]);
  };

  const handleReady = async () => {
    setIsSubmitting(true);
    await submitDraft(roomId, user.uid, squad, teamName.trim() || "My Team", teamIcon);
    setIsSubmitting(false);
    setSubmitted(true);
  };

  const handleStartTournament = async () => {
    setIsSubmitting(true);
    const { initializeMultiplayerTournament } = await import("@/lib/tournamentService");
    const tournamentState = await initializeMultiplayerTournament(room.players);
    
    const roomRef = doc(db, "rooms", roomId);
    await updateDoc(roomRef, { 
      status: "playing",
      tournament: tournamentState
    });
  };

  if (loading || !room || teams.length === 0) {
    return <div className="min-h-screen flex items-center justify-center text-white">Loading draft...</div>;
  }

  const isHost = room.hostId === user?.uid;
  const draftCompleted = squad.length >= 5;
  const allPlayersReady = room.players?.every(p => p.isReady);

  if (submitted) {
    return (
      <main className="min-h-screen p-8 text-white flex flex-col items-center">
        <h1 className="mb-8 text-center text-4xl font-bold text-amber-500">WAITING FOR OTHERS</h1>
        <div className="w-full max-w-2xl bg-neutral-900/80 p-8 rounded-2xl border border-neutral-700 shadow-xl">
          <div className="grid grid-cols-2 gap-4 mb-8">
            {room.players?.map((p, idx) => (
              <div key={p.uid} className={`flex items-center justify-between p-4 rounded-xl border ${p.isReady ? 'border-green-500 bg-green-500/10' : 'border-neutral-700 bg-neutral-800'}`}>
                <span className="font-bold">{p.name} {p.uid === user.uid && "(You)"}</span>
                <span className={`text-xs font-bold px-2 py-1 rounded ${p.isReady ? 'bg-green-600' : 'bg-neutral-700'}`}>
                  {p.isReady ? "READY" : "DRAFTING"}
                </span>
              </div>
            ))}
          </div>
          
          {isHost && (
            <button
              onClick={handleStartTournament}
              disabled={!allPlayersReady}
              className="w-full rounded-xl bg-green-600 px-6 py-4 text-xl font-black uppercase tracking-wider hover:bg-green-500 transition-colors disabled:opacity-50"
            >
              START TOURNAMENT
            </button>
          )}
          {!isHost && allPlayersReady && (
            <div className="text-center text-neutral-400 font-bold">Waiting for host to start the tournament...</div>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8 text-white">
      <h1 className="mb-8 text-center text-4xl font-bold text-amber-500">
        MULTIPLAYER DRAFT - ROUND {Math.min(squad.length + 1, 5)} / 5
      </h1>

      <div className="mx-auto flex max-w-7xl gap-8">
        <section className="flex-1">
          {draftCompleted ?
            <div className="flex h-full flex-col items-center justify-center space-y-6">
              <h2 className="text-4xl font-bold text-amber-500">
                SQUAD COMPLETE!
              </h2>
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

              <div className="w-full max-w-md">
                <LogoCreator onChange={setTeamIcon} />
              </div>

              <button
                onClick={handleReady}
                disabled={isSubmitting}
                className="rounded-xl bg-green-600 px-12 py-6 text-3xl font-bold hover:bg-green-700 transition-colors disabled:opacity-50 mt-4"
              >
                READY
              </button>
            </div>
          : rolledTeams.length === 0 ?
            <SpinScreen onSpin={spin} />
          : !selectedTeam ?
            <TeamSelection
              teams={rolledTeams}
              onSelectTeam={setSelectedTeam}
              onReroll={rerollsLeft > 0 ? reroll : null}
              rerollsLeft={rerollsLeft}
            />
          : <TeamDetails
              team={selectedTeam}
              squad={squad}
              onSelectPlayer={setSelectedPlayer}
              onBack={() => setSelectedTeam(null)}
            />
          }
        </section>

        <SquadPanel squad={squad} />
      </div>

      <RoleSelectionModal
        player={selectedPlayer}
        onClose={() => setSelectedPlayer(null)}
        onSelectRole={handleRoleSelection}
      />
    </main>
  );
}
