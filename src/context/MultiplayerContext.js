"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, updateDoc, getDoc } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { generateScore, generateSwissPairings } from "@/lib/tournamentService";

const MultiplayerContext = createContext();

export function MultiplayerProvider({ children, roomId }) {
  const { user, loading } = useAuth();
  
  const [room, setRoom] = useState(null);
  const [pendingResult, setPendingResult] = useState(null);

  useEffect(() => {
    if (loading || !user || !roomId) return;

    const roomRef = doc(db, "rooms", roomId);
    const unsubscribe = onSnapshot(roomRef, (docSnap) => {
      if (docSnap.exists()) {
        setRoom(docSnap.data());
      }
    });

    return () => unsubscribe();
  }, [roomId, user, loading]);

  if (!room || !room.tournament) {
    return <div className="p-8 text-white text-center">Loading Multiplayer Tournament...</div>;
  }

  const { stage, swissRound, standings, matches } = room.tournament;
  const isHost = room.hostId === user?.uid;

  const myPlayerObj = room.players?.find(p => p.uid === user?.uid);
  const mySquad = myPlayerObj?.squad || [];
  const teamName = myPlayerObj?.teamName || "My Team";

  const completeMatch = async (matchId, result) => {
    const roomRef = doc(db, "rooms", roomId);
    const snap = await getDoc(roomRef);
    if (!snap.exists()) return;
    
    const t = snap.data().tournament;
    const matchIndex = t.matches.findIndex(m => m.id === matchId);
    if (matchIndex === -1 || t.matches[matchIndex].completed) return; // Prevent double write
    
    const updatedMatches = [...t.matches];
    updatedMatches[matchIndex] = { ...updatedMatches[matchIndex], result, completed: true };
    
    let updatedStandings = [...t.standings];
    if (t.stage === "swiss") {
      const teamAIdx = updatedStandings.findIndex(tm => tm.id === result.teamA.id);
      const teamBIdx = updatedStandings.findIndex(tm => tm.id === result.teamB.id);
      
      updatedStandings[teamAIdx] = { ...updatedStandings[teamAIdx] };
      updatedStandings[teamBIdx] = { ...updatedStandings[teamBIdx] };

      if (result.winner === result.teamA.id) {
        updatedStandings[teamAIdx].wins += 1;
        updatedStandings[teamBIdx].losses += 1;
      } else {
        updatedStandings[teamBIdx].wins += 1;
        updatedStandings[teamAIdx].losses += 1;
      }
    }

    await updateDoc(roomRef, {
      "tournament.matches": updatedMatches,
      "tournament.standings": updatedStandings
    });
  };

  const startMatches = async () => {
    if (!isHost) return;
    const roomRef = doc(db, "rooms", roomId);
    await updateDoc(roomRef, { "tournament.matchesStarted": true });
  };

  const advanceStage = async () => {
    if (!isHost) return;
    
    const roomRef = doc(db, "rooms", roomId);
    const snap = await getDoc(roomRef);
    if (!snap.exists()) return;
    
    const t = snap.data().tournament;
    
    if (t.stage === "swiss") {
      const currentRoundMatches = t.matches.filter(m => m.round === t.swissRound);
      let updatedStandings = [...t.standings].map(tm => ({...tm}));
      let newCompletedMatches = [];

      currentRoundMatches.forEach(m => {
        if (!m.completed && !m.isPlayerMatch) {
          const winner = Math.random() > 0.5 ? m.teamA : m.teamB;
          const { winnerScore, loserScore } = generateScore();
          const result = { teamA: m.teamA, teamB: m.teamB, winner: winner.id, scoreA: winner.id === m.teamA.id ? winnerScore : loserScore, scoreB: winner.id === m.teamA.id ? loserScore : winnerScore };
          newCompletedMatches.push({ id: m.id, result });
          
          const teamAIdx = updatedStandings.findIndex(tm => tm.id === m.teamA.id);
          const teamBIdx = updatedStandings.findIndex(tm => tm.id === m.teamB.id);
          if (winner.id === m.teamA.id) {
            updatedStandings[teamAIdx].wins += 1;
            updatedStandings[teamBIdx].losses += 1;
          } else {
            updatedStandings[teamBIdx].wins += 1;
            updatedStandings[teamAIdx].losses += 1;
          }
        }
      });

      let updatedMatches = t.matches.map(m => {
        const found = newCompletedMatches.find(n => n.id === m.id);
        if (found) return { ...m, result: found.result, completed: true };
        return m;
      });

      const swissComplete = updatedStandings.every(tm => tm.wins >= 3 || tm.losses >= 3);
      
      if (swissComplete) {
        await updateDoc(roomRef, {
          "tournament.matches": updatedMatches,
          "tournament.standings": updatedStandings,
          "tournament.stage": "swiss_complete",
          "tournament.matchesStarted": false
        });
      } else {
        const nextRound = t.swissRound + 1;
        const active = updatedStandings.filter(tm => tm.wins < 3 && tm.losses < 3);
        const newMatches = generateSwissPairings(active, updatedMatches, nextRound);
        
        await updateDoc(roomRef, {
          "tournament.matches": [...updatedMatches, ...newMatches],
          "tournament.standings": updatedStandings,
          "tournament.swissRound": nextRound,
          "tournament.matchesStarted": false
        });
      }
    } else if (t.stage === "playoffs") {
      const playoffRounds = ['Quarterfinals', 'Semifinals', 'Final'];
      let newCompletedMatches = [];
      t.matches.forEach(m => {
        if (!m.completed && !m.isPlayerMatch && playoffRounds.includes(m.round)) {
          const isFinal = m.round === 'Final';
          const bestOf = isFinal ? 5 : 3;
          const mapsToWin = Math.ceil(bestOf / 2);
          
          let winsA = 0, winsB = 0;
          while (winsA < mapsToWin && winsB < mapsToWin) {
            const winnerMap = Math.random() > 0.5 ? 'A' : 'B';
            if (winnerMap === 'A') winsA++;
            else winsB++;
          }
          const winnerId = winsA > winsB ? m.teamA.id : m.teamB.id;
          const result = { teamA: m.teamA, teamB: m.teamB, winner: winnerId, scoreA: winsA, scoreB: winsB };
          newCompletedMatches.push({ id: m.id, result });
        }
      });

      let updatedMatches = t.matches.map(m => {
        const found = newCompletedMatches.find(n => n.id === m.id);
        if (found) return { ...m, result: found.result, completed: true };
        return m;
      });

      const qfMatches = updatedMatches.filter(m => m.round === 'Quarterfinals');
      const sfMatches = updatedMatches.filter(m => m.round === 'Semifinals');
      const finalMatch = updatedMatches.find(m => m.round === 'Final');

      if (finalMatch && finalMatch.completed) {
        await updateDoc(roomRef, {
          "tournament.matches": updatedMatches,
          "tournament.stage": "won",
          "tournament.matchesStarted": false
        });
        return;
      }

      if (qfMatches.length === 4 && qfMatches.every(m => m.completed) && sfMatches.length === 0) {
        const getWinner = (match) => match.result.winner === match.teamA.id ? match.teamA : match.teamB;
        const sf = [
          { id: 'SF_M0', round: 'Semifinals', teamA: getWinner(qfMatches[0]), teamB: getWinner(qfMatches[1]), result: null, completed: false },
          { id: 'SF_M1', round: 'Semifinals', teamA: getWinner(qfMatches[2]), teamB: getWinner(qfMatches[3]), result: null, completed: false }
        ];
        sf[0].isPlayerMatch = sf[0].teamA.isPlayer || sf[0].teamB.isPlayer;
        sf[0].playerUids = [sf[0].teamA.uid, sf[0].teamB.uid].filter(Boolean);
        sf[1].isPlayerMatch = sf[1].teamA.isPlayer || sf[1].teamB.isPlayer;
        sf[1].playerUids = [sf[1].teamA.uid, sf[1].teamB.uid].filter(Boolean);
        
        await updateDoc(roomRef, { "tournament.matches": [...updatedMatches, ...sf], "tournament.matchesStarted": false });
        return;
      }
      
      if (sfMatches.length === 2 && sfMatches.every(m => m.completed) && !finalMatch) {
        const getWinner = (match) => match.result.winner === match.teamA.id ? match.teamA : match.teamB;
        const fin = { id: 'F_M0', round: 'Final', teamA: getWinner(sfMatches[0]), teamB: getWinner(sfMatches[1]), result: null, completed: false };
        fin.isPlayerMatch = fin.teamA.isPlayer || fin.teamB.isPlayer;
        fin.playerUids = [fin.teamA.uid, fin.teamB.uid].filter(Boolean);
        
        await updateDoc(roomRef, { "tournament.matches": [...updatedMatches, fin], "tournament.matchesStarted": false });
        return;
      }

      await updateDoc(roomRef, { "tournament.matches": updatedMatches, "tournament.matchesStarted": false });
    }
  };

  const continueToPlayoffs = async () => {
    if (!isHost) return;
    const roomRef = doc(db, "rooms", roomId);
    
    let qualified = room.tournament.standings
      .filter(tm => tm.wins >= 3)
      .sort((a, b) => a.losses - b.losses);
      
    if (qualified.length < 8) {
      const qualifiedIds = new Set(qualified.map(tm => tm.id));
      const remaining = room.tournament.standings
        .filter(tm => !qualifiedIds.has(tm.id))
        .sort((a, b) => b.wins - a.wins || a.losses - b.losses);
      qualified = [...qualified, ...remaining].slice(0, 8);
    }

    const qfMatches = [];
    for (let i = 0; i < 4; i++) {
      const teamA = qualified[i];
      const teamB = qualified[7 - i];
      if (!teamA || !teamB) continue;
      qfMatches.push({
        id: `QF_M${i}`,
        round: 'Quarterfinals',
        teamA,
        teamB,
        result: null,
        isPlayerMatch: teamA.isPlayer || teamB.isPlayer,
        playerUids: [teamA.uid, teamB.uid].filter(Boolean),
        completed: false,
      });
    }
    
    await updateDoc(roomRef, {
      "tournament.stage": "playoffs",
      "tournament.matches": [...room.tournament.matches, ...qfMatches],
      "tournament.matchesStarted": false
    });
  };

  const showFinalResult = () => setPendingResult(null);

  const contextValue = {
    isMultiplayer: true,
    isHost,
    roomId,
    userUid: user?.uid,
    mySquad,
    teamName,
    stage,
    swissRound,
    standings,
    matches,
    matchesStarted: room.tournament.matchesStarted,
    startMatches,
    pendingResult,
    completeMatch,
    advanceRound: advanceStage,
    continueToPlayoffs,
    showFinalResult
  };

  return (
    <MultiplayerContext.Provider value={contextValue}>
      {children}
    </MultiplayerContext.Provider>
  );
}

export const useMultiplayerTournament = () => useContext(MultiplayerContext);
