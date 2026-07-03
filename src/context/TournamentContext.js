"use client";

import { createContext, useContext, useState, useEffect } from "react";
import teamsData from "@/data/teams.json";

import { formatTeamForSimulation } from "@/app/utils/playerExpansion";

const TournamentContext = createContext();

export function TournamentProvider({ children }) {
  const [mySquad, setMySquad] = useState([]);
  const [stage, setStage] = useState("swiss"); // "swiss", "playoffs", "eliminated", "won"
  const [swissRound, setSwissRound] = useState(1);
  const [standings, setStandings] = useState([]); // [{ teamId, wins, losses }]
  const [matches, setMatches] = useState([]); // [{ round, teamA, teamB, result, isPlayerMatch, completed }]

  // Initialize tournament
  const initTournament = (squad) => {
    setMySquad(squad);
    setStage("swiss");
    setSwissRound(1);
    setMatches([]);
    
    // Pick random teams from DB to fill the 15 spots
    let otherTeams = [...teamsData].sort(() => Math.random() - 0.5);
    while (otherTeams.length < 15) {
      // Pad with duplicates if we don't have enough teams in DB yet
      otherTeams.push(
        ...[...teamsData].sort(() => Math.random() - 0.5).slice(0, 15 - otherTeams.length)
      );
    }
    otherTeams = otherTeams.slice(0, 15);
    
    const initialStandings = [
      { id: "player_team", ...formatTeamForSimulation({ name: "My Team", isPlayer: true, icon: "/logos/faze.png" }, squad), isPlayer: true, wins: 0, losses: 0 },
      ...otherTeams.map((t, i) => ({ id: `${t.id}_${i}`, ...formatTeamForSimulation(t), isPlayer: false, wins: 0, losses: 0 }))
    ];
    setStandings(initialStandings);
    
    // Generate Round 1 matchups
    generateSwissMatchups(initialStandings, 1);
  };

  const generateSwissMatchups = (currentStandings, round) => {
    // Basic Swiss pairing: sort by score, pair adjacent
    const sorted = [...currentStandings].sort((a, b) => b.wins - a.wins || a.losses - b.losses);
    const newMatches = [];
    for (let i = 0; i < sorted.length; i += 2) {
      if (i + 1 < sorted.length) {
        newMatches.push({
          id: `R${round}_M${i/2}`,
          round,
          teamA: sorted[i],
          teamB: sorted[i + 1],
          result: null,
          isPlayerMatch: sorted[i].isPlayer || sorted[i + 1].isPlayer,
          completed: false,
        });
      }
    }
    setMatches(prev => [...prev, ...newMatches]);
  };

  const completeMatch = (matchId, result) => {
    setMatches(prev => prev.map(m => m.id === matchId ? { ...m, result, completed: true } : m));
    
    // Update standings
    setStandings(prev => {
      const newStandings = [...prev];
      const teamAIdx = newStandings.findIndex(t => t.id === result.teamA.id);
      const teamBIdx = newStandings.findIndex(t => t.id === result.teamB.id);
      
      if (result.winner === result.teamA.id) {
        newStandings[teamAIdx].wins += 1;
        newStandings[teamBIdx].losses += 1;
      } else {
        newStandings[teamBIdx].wins += 1;
        newStandings[teamAIdx].losses += 1;
      }
      return newStandings;
    });
  };

  const advanceRound = () => {
    // Check if player eliminated or advanced
    const playerTeam = standings.find(t => t.isPlayer);
    if (playerTeam.losses === 3) {
      setStage("eliminated");
      return;
    }
    if (playerTeam.wins === 3) {
      setStage("playoffs");
      // TODO: initialize playoffs
      return;
    }
    
    // Auto-resolve non-player matches for the current round if not completed
    const currentRoundMatches = matches.filter(m => m.round === swissRound);
    currentRoundMatches.forEach(m => {
      if (!m.completed && !m.isPlayerMatch) {
        // simulate basic win
        const winner = Math.random() > 0.5 ? m.teamA : m.teamB;
        completeMatch(m.id, { teamA: m.teamA, teamB: m.teamB, winner: winner.id, scoreA: 13, scoreB: 10 }); // Dummy score
      }
    });

    const nextRound = swissRound + 1;
    setSwissRound(nextRound);
    generateSwissMatchups(standings, nextRound);
  };

  return (
    <TournamentContext.Provider value={{
      mySquad, stage, swissRound, standings, matches,
      initTournament, completeMatch, advanceRound
    }}>
      {children}
    </TournamentContext.Provider>
  );
}

export function useTournament() {
  return useContext(TournamentContext);
}
