"use client";

import { createContext, useContext, useState, useEffect } from "react";
import teamsData from "@/data/teams.json";

import { formatTeamForSimulation } from "@/app/utils/playerExpansion";

const TournamentContext = createContext();

// Genera scores realistas de CS2 para matches NPC
function generateScore() {
  const roll = Math.random();
  let winnerScore, loserScore;

  if (roll < 0.20) {
    // ~20% overtime (MR12 → empate 12-12, luego OT de 3 rondas)
    const otRounds = Math.random() < 0.7 ? 1 : 2; // 1 o 2 tiempos extra
    winnerScore = 13 + otRounds * 3;
    loserScore = winnerScore - 2; // OT siempre se gana por 2 (16-14, 19-17)
  } else if (roll < 0.45) {
    // ~25% partida cerrada (13-10, 13-11, 13-12)
    winnerScore = 13;
    loserScore = 10 + Math.floor(Math.random() * 3); // 10, 11, o 12
  } else if (roll < 0.75) {
    // ~30% partida normal (13-6 a 13-9)
    winnerScore = 13;
    loserScore = 6 + Math.floor(Math.random() * 4); // 6, 7, 8, o 9
  } else {
    // ~25% dominio claro (13-2 a 13-5)
    winnerScore = 13;
    loserScore = 2 + Math.floor(Math.random() * 4); // 2, 3, 4, o 5
  }

  return { winnerScore, loserScore };
}

export function TournamentProvider({ children }) {
  const [mySquad, setMySquad] = useState([]);
  const [teamName, setTeamName] = useState("My Team");
  const [stage, setStage] = useState("swiss"); // "swiss", "swiss_complete", "playoffs", "results_pending", "eliminated", "won"
  const [pendingResult, setPendingResult] = useState(null); // "eliminated" or "won"
  const [swissRound, setSwissRound] = useState(1);
  const [standings, setStandings] = useState([]); // [{ teamId, wins, losses }]
  const [matches, setMatches] = useState([]); // [{ round, teamA, teamB, result, isPlayerMatch, completed }]

  // Initialize tournament
  const initTournament = (squad, name = "My Team") => {
    setMySquad(squad);
    setTeamName(name);
    setStage("swiss");
    setSwissRound(1);
    setMatches([]);
    setPendingResult(null);
    
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
      { id: "player_team", ...formatTeamForSimulation({ name, isPlayer: true, icon: "/logos/faze.png" }, squad), isPlayer: true, wins: 0, losses: 0 },
      ...otherTeams.map((t, i) => ({ id: `${t.id}_${i}`, ...formatTeamForSimulation(t), isPlayer: false, wins: 0, losses: 0 }))
    ];
    setStandings(initialStandings);
    
    // Generate Round 1 matchups
    generateSwissMatchups(initialStandings, 1);
  };

  const generateSwissMatchups = (currentStandings, round) => {
    // Basic Swiss pairing: sort by score, pair adjacent
    const active = currentStandings.filter(t => t.wins < 3 && t.losses < 3);
    const sorted = [...active].sort((a, b) => b.wins - a.wins || a.losses - b.losses);
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
    
    if (stage === "swiss") {
      // Update standings
      setStandings(prev => {
        const newStandings = [...prev];
        const teamAIdx = newStandings.findIndex(t => t.id === result.teamA.id);
        const teamBIdx = newStandings.findIndex(t => t.id === result.teamB.id);
        
        newStandings[teamAIdx] = { ...newStandings[teamAIdx] };
        newStandings[teamBIdx] = { ...newStandings[teamBIdx] };

        if (result.winner === result.teamA.id) {
          newStandings[teamAIdx].wins += 1;
          newStandings[teamBIdx].losses += 1;
        } else {
          newStandings[teamBIdx].wins += 1;
          newStandings[teamAIdx].losses += 1;
        }
        return newStandings;
      });
    }
  };

  const advanceRound = () => {
    // First, auto-resolve non-player matches for the current round if not completed
    const currentRoundMatches = matches.filter(m => m.round === swissRound);
    let updatedStandings = [...standings].map(t => ({...t}));
    let newCompletedMatches = [];

    currentRoundMatches.forEach(m => {
      if (!m.completed && !m.isPlayerMatch) {
        // simulate basic win
        const winner = Math.random() > 0.5 ? m.teamA : m.teamB;
        const { winnerScore, loserScore } = generateScore();
        const result = { teamA: m.teamA, teamB: m.teamB, winner: winner.id, scoreA: winner.id === m.teamA.id ? winnerScore : loserScore, scoreB: winner.id === m.teamA.id ? loserScore : winnerScore };
        newCompletedMatches.push({ id: m.id, result });
        
        const teamAIdx = updatedStandings.findIndex(t => t.id === m.teamA.id);
        const teamBIdx = updatedStandings.findIndex(t => t.id === m.teamB.id);
        if (winner.id === m.teamA.id) {
          updatedStandings[teamAIdx].wins += 1;
          updatedStandings[teamBIdx].losses += 1;
        } else {
          updatedStandings[teamBIdx].wins += 1;
          updatedStandings[teamAIdx].losses += 1;
        }
      }
    });

    let updatedMatches = matches;
    if (newCompletedMatches.length > 0) {
      updatedMatches = matches.map(m => {
        const found = newCompletedMatches.find(n => n.id === m.id);
        if (found) return { ...m, result: found.result, completed: true };
        return m;
      });
      setMatches(updatedMatches);
      setStandings(updatedStandings);
    }

    // Now check if player is eliminated or qualified
    const playerTeam = updatedStandings.find(t => t.isPlayer);
    if (playerTeam.losses === 3) {
      // Pausar en results_pending para mostrar los resultados antes del modal
      setPendingResult("eliminated");
      setStage("results_pending");
      return;
    }
    if (playerTeam.wins === 3) {
      // Player qualified — but we need to finish the entire Swiss stage for remaining teams
      // Simulate remaining Swiss rounds for non-player teams until all teams have 3 wins or 3 losses
      let simStandings = updatedStandings.map(t => ({...t}));
      let simMatches = [...updatedMatches];
      let simRound = swissRound + 1;

      const swissComplete = (s) => s.every(t => t.wins >= 3 || t.losses >= 3);

      while (!swissComplete(simStandings)) {
        // Filter active teams (not yet 3 wins or 3 losses), excluding the player
        const active = simStandings
          .filter(t => t.wins < 3 && t.losses < 3 && !t.isPlayer)
          .sort((a, b) => b.wins - a.wins || a.losses - b.losses);
        
        if (active.length < 2) break; // safety: can't pair

        for (let i = 0; i < active.length; i += 2) {
          if (i + 1 >= active.length) break;
          const tA = active[i];
          const tB = active[i + 1];
          const winner = Math.random() > 0.5 ? tA : tB;
          const { winnerScore: ws, loserScore: ls } = generateScore();
          const result = { teamA: tA, teamB: tB, winner: winner.id, scoreA: winner.id === tA.id ? ws : ls, scoreB: winner.id === tA.id ? ls : ws };
          
          const matchEntry = {
            id: `R${simRound}_M${i/2}`,
            round: simRound,
            teamA: tA,
            teamB: tB,
            result,
            isPlayerMatch: false,
            completed: true,
          };
          simMatches.push(matchEntry);
          
          const teamAIdx = simStandings.findIndex(t => t.id === tA.id);
          const teamBIdx = simStandings.findIndex(t => t.id === tB.id);
          if (winner.id === tA.id) {
            simStandings[teamAIdx].wins += 1;
            simStandings[teamBIdx].losses += 1;
          } else {
            simStandings[teamBIdx].wins += 1;
            simStandings[teamAIdx].losses += 1;
          }
        }
        simRound++;
        if (simRound > 20) break; // safety limit
      }

      setMatches(simMatches);
      setStandings(simStandings);
      // Pausar en swiss_complete para mostrar el cuadro Swiss final
      setStage("swiss_complete");
      return;
    }
    
    const nextRound = swissRound + 1;
    setSwissRound(nextRound);
    generateSwissMatchups(updatedStandings, nextRound);
  };

  const advancePlayoffs = () => {
    const playoffRounds = ['Quarterfinals', 'Semifinals', 'Final'];
    
    // Simulate incomplete non-player playoff matches
    let newCompletedMatches = [];
    matches.forEach(m => {
      if (!m.completed && !m.isPlayerMatch && playoffRounds.includes(m.round)) {
        const winner = Math.random() > 0.5 ? m.teamA : m.teamB;
        const { winnerScore: pws, loserScore: pls } = generateScore();
        const result = { teamA: m.teamA, teamB: m.teamB, winner: winner.id, scoreA: winner.id === m.teamA.id ? pws : pls, scoreB: winner.id === m.teamA.id ? pls : pws };
        newCompletedMatches.push({ id: m.id, result });
      }
    });

    let updatedMatches = [...matches];
    if (newCompletedMatches.length > 0) {
      updatedMatches = matches.map(m => {
        const found = newCompletedMatches.find(n => n.id === m.id);
        if (found) return { ...m, result: found.result, completed: true };
        return m;
      });
      setMatches(updatedMatches);
    }

    // FIRST: Check if player lost any playoff match → eliminate immediately
    const playerLostMatch = updatedMatches.find(m => 
      m.isPlayerMatch && m.completed && playoffRounds.includes(m.round) && m.result.winner !== 'player_team'
    );
    if (playerLostMatch) {
      setPendingResult("eliminated");
      setStage("results_pending");
      return;
    }

    // Check current playoff state
    const qfMatches = updatedMatches.filter(m => m.round === 'Quarterfinals');
    const sfMatches = updatedMatches.filter(m => m.round === 'Semifinals');
    const finalMatch = updatedMatches.find(m => m.round === 'Final');

    // Check if player won the tournament
    if (finalMatch && finalMatch.completed && finalMatch.result.winner === 'player_team') {
      setPendingResult("won");
      setStage("results_pending");
      return;
    }

    // Generate next round
    if (qfMatches.length === 4 && qfMatches.every(m => m.completed) && sfMatches.length === 0) {
      const getWinner = (match) => match.result.winner === match.teamA.id ? match.teamA : match.teamB;
      const sf = [
        { id: 'SF_M0', round: 'Semifinals', teamA: getWinner(qfMatches[0]), teamB: getWinner(qfMatches[1]), result: null, completed: false },
        { id: 'SF_M1', round: 'Semifinals', teamA: getWinner(qfMatches[2]), teamB: getWinner(qfMatches[3]), result: null, completed: false }
      ];
      sf[0].isPlayerMatch = sf[0].teamA.isPlayer || sf[0].teamB.isPlayer;
      sf[1].isPlayerMatch = sf[1].teamA.isPlayer || sf[1].teamB.isPlayer;
      setMatches(prev => [...prev, ...sf]);
      return;
    }
    
    if (sfMatches.length === 2 && sfMatches.every(m => m.completed) && !finalMatch) {
      const getWinner = (match) => match.result.winner === match.teamA.id ? match.teamA : match.teamB;
      const fin = {
        id: 'F_M0', round: 'Final', teamA: getWinner(sfMatches[0]), teamB: getWinner(sfMatches[1]), result: null, completed: false
      };
      fin.isPlayerMatch = fin.teamA.isPlayer || fin.teamB.isPlayer;
      setMatches(prev => [...prev, fin]);
      return;
    }
  };

  const advanceStage = () => {
    if (stage === "swiss") advanceRound();
    else if (stage === "playoffs") advancePlayoffs();
  };

  // Continuar de swiss_complete a playoffs
  const continueToPlayoffs = () => {
    setStage("playoffs");
    initPlayoffs(standings);
  };

  // Mostrar resultado final (desde results_pending)
  const showFinalResult = () => {
    if (pendingResult) {
      setStage(pendingResult);
      setPendingResult(null);
    }
  };

  const initPlayoffs = (finalStandings) => {
    // Top 8 teams advance — those with 3 wins
    let qualified = finalStandings
      .filter(t => t.wins >= 3)
      .sort((a, b) => a.losses - b.losses);
    
    // Safety: if fewer than 8 qualified, fill with best remaining teams
    if (qualified.length < 8) {
      const qualifiedIds = new Set(qualified.map(t => t.id));
      const remaining = finalStandings
        .filter(t => !qualifiedIds.has(t.id))
        .sort((a, b) => b.wins - a.wins || a.losses - b.losses);
      qualified = [...qualified, ...remaining].slice(0, 8);
    }

    // Matches will be generated for quarterfinals
    const qfMatches = [];
    // 1st vs 8th, 2nd vs 7th, 3rd vs 6th, 4th vs 5th
    for (let i = 0; i < 4; i++) {
      const teamA = qualified[i];
      const teamB = qualified[7 - i];
      if (!teamA || !teamB) continue; // extra safety
      qfMatches.push({
        id: `QF_M${i}`,
        round: 'Quarterfinals',
        teamA,
        teamB,
        result: null,
        isPlayerMatch: teamA.isPlayer || teamB.isPlayer,
        completed: false,
      });
    }
    setMatches(prev => [...prev, ...qfMatches]);
  };

  return (
    <TournamentContext.Provider value={{
      mySquad, teamName, stage, swissRound, standings, matches, pendingResult,
      initTournament, completeMatch, advanceRound: advanceStage,
      continueToPlayoffs, showFinalResult
    }}>
      {children}
    </TournamentContext.Provider>
  );
}

export function useTournament() {
  return useContext(TournamentContext);
}
