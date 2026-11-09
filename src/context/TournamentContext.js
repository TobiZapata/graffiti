"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { CAREER_KEY, loadCareer, saveCareer, validOrganization } from "@/lib/localCareer.mjs";
import { buildMajorRecord } from "@/lib/organizationProfile.mjs";
import { moveOrganizationRole } from "@/lib/organizationRoles.mjs";

import { formatTeamForSimulation } from "@/app/utils/playerExpansion";
import { generateSwissPairings } from "@/lib/tournamentService";

import { CURRENT_SIMULATION } from "@/lib/simulationVersion.mjs";
import { upgradeOrganization } from "@/lib/upgradeOrganization.mjs";
import { simulateNpcMatch } from "@/lib/simulateNpcMatch.mjs";

const TournamentContext = createContext();

export function TournamentProvider({ children }) {
  const [mySquad, setMySquad] = useState([]);
  const [teamName, setTeamName] = useState("My Team");
  const [stage, setStage] = useState("swiss"); // "swiss", "swiss_complete", "playoffs", "results_pending", "eliminated", "won"
  const [pendingResult, setPendingResult] = useState(null); // "eliminated" or "won"
  const [swissRound, setSwissRound] = useState(1);
  const [standings, setStandings] = useState([]); // [{ teamId, wins, losses }]
  const [matches, setMatches] = useState([]); // [{ round, teamA, teamB, result, isPlayerMatch, completed }]

  const [organization, setOrganization] = useState(null);
  const [tournamentId, setTournamentId] = useState(null);
  const [simulation, setSimulation] = useState(null);
  const [matchProgress, setMatchProgress] = useState({});
  const [storageError, setStorageError] = useState(null);
  const [ready, setReady] = useState(false);
  const writesBlocked = useRef(false);
  const completedIds = useRef(new Set());
  const completedResults = useRef(new Map());

  // Hydration must finish before tournament consumers mount.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    let loaded;
    try { loaded = loadCareer(window.localStorage); }
    catch { loaded = { error: "Local storage is not available in this browser." }; }
    if (loaded.error) { writesBlocked.current = true; setStorageError(loaded.error); }
    if (loaded.data) {
      const { organization: org, tournament: t, matchProgress: progress } = loaded.data;
      setOrganization(org); setMatchProgress(progress);
      if (t) {
        setSimulation(t.simulation ?? null);
        setTournamentId(t.tournamentId); setMySquad(t.mySquad); setTeamName(t.teamName);
        setStage(t.stage); setPendingResult(t.pendingResult); setSwissRound(t.swissRound);
        setStandings(t.standings); setMatches(t.matches);
        completedIds.current = new Set(t.matches.filter(m => m.completed).map(m => m.id));
      }
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || !organization || writesBlocked.current) return;
    const tournament = tournamentId ? { tournamentId, simulation, mySquad, teamName, stage, pendingResult, swissRound, standings, matches } : null;
    let error;
    try { error = saveCareer(window.localStorage, { version: 1, organization, tournament, matchProgress }); }
    catch { error = "Local storage is not available in this browser."; }
    setStorageError(error);
  }, [ready, organization, tournamentId, simulation, mySquad, teamName, stage, pendingResult, swissRound, standings, matches, matchProgress]);

  useEffect(() => {
    const onStorage = event => {
      if (event.key !== CAREER_KEY && event.key !== null) return;
      writesBlocked.current = true;
      setStorageError("Your game changed in another tab. Reload this page to continue.");
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  /* eslint-enable react-hooks/set-state-in-effect */
  const createOrganization = input => {
    if (organization || writesBlocked.current) throw new Error("An organization already exists, or the saved game could not be read.");
    const org = { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    if (!validOrganization(org)) throw new Error("The organization or its roles are not valid.");
    setOrganization(org);
    return org;
  };

  const assignOrganizationRole = (field, targetUid) => {
    if (!organization || writesBlocked.current) throw new Error("There is no organization.");
    const updated = moveOrganizationRole(organization, field, targetUid);
    setOrganization(updated);
  };

  const startOrganizationMajor = async () => {
    if (!organization || writesBlocked.current) throw new Error("There is no organization.");
    if (tournamentId && !["won", "eliminated", "results_pending"].includes(stage)) throw new Error("The current Major is still in progress.");
    const { default: catalog } = await import("@/data/teams.json");
    let nextOrganization = upgradeOrganization(organization, catalog);
    if (nextOrganization !== organization) {
      if (!validOrganization(nextOrganization)) throw new Error("The updated roster is not valid. Your saved organization was kept.");
      try {
        const backupKey = `${CAREER_KEY}:before-player-v2`;
        if (window.localStorage.getItem(backupKey) === null) window.localStorage.setItem(backupKey, window.localStorage.getItem(CAREER_KEY));
      } catch { throw new Error("The roster backup could not be saved. Your organization was kept."); }
    }
    if (tournamentId) {
      const record = buildMajorRecord({ tournamentId, stage, pendingResult, matches });
      nextOrganization = { ...nextOrganization, majorHistory: [...(organization.majorHistory || []).filter(r => r.id !== tournamentId), record] };
    }
    await initTournament(nextOrganization.squad, organization.name, organization.icon, {
      mainAwperUid: organization.mainAwperUid, iglUid: organization.iglUid, starUid: organization.starUid
    }, nextOrganization);
  };

  const saveMatchProgress = useCallback((matchId, progress) => {
    setMatchProgress(prev => ({ ...prev, [matchId]: progress }));
  }, []);

  // Initialize tournament
  const initTournament = async (squad, name = "My Team", icon = "/logos/faze.png", roles = {}, nextOrganization = null) => {
    const { default: teamsData } = await import("@/data/teams.json");
    if (writesBlocked.current) throw new Error("Your saved game cannot be written. Reload this page to continue.");
    
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
      { id: "player_team", ...formatTeamForSimulation({ name, isPlayer: true, icon: icon, ...roles }, squad), isPlayer: true, starUid: roles.starUid, wins: 0, losses: 0 },
      ...otherTeams.map((t, i) => ({ id: `${t.id}_${i}`, ...formatTeamForSimulation(t), isPlayer: false, wins: 0, losses: 0 }))
    ];
    // Generate Round 1 matchups
    const initialMatches = generateSwissPairings(initialStandings, [], 1);
    const nextTournamentId = crypto.randomUUID();
    if (nextOrganization) setOrganization(nextOrganization);
    setTournamentId(nextTournamentId);
    setSimulation(CURRENT_SIMULATION);
    setMatchProgress({});
    completedIds.current = new Set();
    setMySquad(squad);
    setTeamName(name);
    setStage("swiss");
    setSwissRound(1);
    setPendingResult(null);
    setStandings(initialStandings);
    setMatches(initialMatches);
  };

  const generateSwissMatchups = (currentStandings, round) => {
    const active = currentStandings.filter(t => t.wins < 3 && t.losses < 3);
    const newMatches = generateSwissPairings(active, matches, round);
    setMatches(prev => [...prev, ...newMatches]);
  };

  const completeMatch = (matchId, result) => {
    const match = matches.find(m => m.id === matchId);
    if (!match) return;
    if (match.completed) return match.result;
    if (completedIds.current.has(matchId)) return completedResults.current.get(matchId);
    if (!result || result.teamA?.id !== match.teamA.id || result.teamB?.id !== match.teamB.id || ![match.teamA.id, match.teamB.id].includes(result.winner)) return;
    if (writesBlocked.current) {
      const error = storageError || "Your saved game cannot be written. Reload this page to continue.";
      setStorageError(error);
      throw new Error(error);
    }
    const nextProgress = { ...matchProgress };
    delete nextProgress[matchId];
    const nextMatches = matches.map(m => m.id === matchId ? { ...m, result, completed: true } : m);
    let nextStandings = standings;
    if (stage === "swiss") {
      nextStandings = standings.map(team => {
        if (team.id !== result.teamA.id && team.id !== result.teamB.id) return team;
        return team.id === result.winner ? { ...team, wins: team.wins + 1 } : { ...team, losses: team.losses + 1 };
      });
    }
    let error;
    try {
      error = saveCareer(window.localStorage, { version: 1, organization,
        tournament: { tournamentId, simulation, mySquad, teamName, stage, pendingResult, swissRound, standings: nextStandings, matches: nextMatches },
        matchProgress: nextProgress });
    } catch { error = "Local storage is not available in this browser."; }
    if (error) { setStorageError(error); throw new Error(error); }
    setStorageError(null);
    completedIds.current.add(matchId);
    completedResults.current.set(matchId, result);
    setMatchProgress(nextProgress);
    setMatches(nextMatches);
    if (stage === "swiss") setStandings(nextStandings);
    return result;
  };

  const advanceRound = () => {
    // First, auto-resolve non-player matches for the current round if not completed
    const currentRoundMatches = matches.filter(m => m.round === swissRound);
    let updatedStandings = [...standings].map(t => ({...t}));
    let newCompletedMatches = [];

    currentRoundMatches.forEach(m => {
      if (!m.completed && !m.isPlayerMatch) {
        const result = simulateNpcMatch(m, tournamentId, simulation);
        const winner = result.winner === m.teamA.id ? m.teamA : m.teamB;
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
        const active = simStandings.filter(t => t.wins < 3 && t.losses < 3 && !t.isPlayer);
        if (active.length < 2) break; // safety
        
        const roundMatches = generateSwissPairings(active, simMatches, simRound);
        
        for (const matchEntry of roundMatches) {
          const tA = matchEntry.teamA;
          const tB = matchEntry.teamB;
          const result = simulateNpcMatch(matchEntry, tournamentId, simulation);
          const winner = result.winner === tA.id ? tA : tB;

          matchEntry.result = result;
          matchEntry.completed = true;
          simMatches.push(matchEntry);
          
          const teamAIdx = simStandings.findIndex(t => t.id === tA.id);
          const teamBIdx = simStandings.findIndex(t => t.id === tB.id);
          simStandings[teamAIdx] = { ...simStandings[teamAIdx] };
          simStandings[teamBIdx] = { ...simStandings[teamBIdx] };
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
        const result = simulateNpcMatch(m, tournamentId, simulation);
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

  if (!ready) return null;

  return (
    <TournamentContext.Provider value={{
      mySquad, teamName, stage, swissRound, standings, matches, pendingResult,
      organization, createOrganization, assignOrganizationRole, startOrganizationMajor, tournamentId, simulation, matchProgress, saveMatchProgress, storageError, ready,
      initTournament, completeMatch, advanceRound: advanceStage,
      continueToPlayoffs, showFinalResult
    }}>
      {storageError && <div role="alert">{storageError}</div>}
      {children}
    </TournamentContext.Provider>
  );
}

export function useTournament() {
  return useContext(TournamentContext);
}
