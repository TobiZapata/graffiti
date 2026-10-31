"use client";

import { createContext, useContext, useState, useEffect, useMemo } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, doc, onSnapshot, query, runTransaction, where } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { returnRoomToLobby } from "@/lib/roomService";
import { useAuth } from "@/context/AuthContext";
import { generateScore, generateSwissPairings } from "@/lib/tournamentService";
import { decodeRoom } from "@/lib/roomStorage.mjs";
import { applyForfeits } from "@/lib/roomForfeit.mjs";
import { applySubmittedResults, matchResultId, validMatchResult } from "@/lib/multiplayerResults.mjs";

const MultiplayerContext = createContext();

export function MultiplayerProvider({ children, roomId, viewResults = false }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [error, setError] = useState(null);
  
  const [room, setRoom] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [resultsLoaded, setResultsLoaded] = useState(null);
  const [pendingResult, setPendingResult] = useState(null);


  useEffect(() => {
    if (loading || !user || !roomId) return;

    const roomRef = doc(db, "rooms", roomId);
    const unsubscribe = onSnapshot(roomRef, (docSnap) => {
      if (docSnap.exists()) {
        setRoom(decodeRoom(docSnap.data()));
      } else setError("Room not found.");
    }, err => setError(err.message));

    return () => unsubscribe();
  }, [roomId, user, loading]);

  const activeTournamentId = room?.tournament?.tournamentId;
  const isMember = !!room?.players.some(p => p.uid === user?.uid && !p.left);
  useEffect(() => {
    if (!activeTournamentId || !isMember) return;
    return onSnapshot(query(collection(db, 'rooms', roomId, 'results'), where('tournamentId', '==', activeTournamentId)), { includeMetadataChanges: true },
      snapshot => {
        setSubmissions(snapshot.docs.filter(s => !s.metadata.hasPendingWrites).map(s => s.data()));
        if (!snapshot.metadata.fromCache) setResultsLoaded(activeTournamentId);
      }, err => setError(err.message));
  }, [roomId, activeTournamentId, isMember]);
  const resolved = useMemo(() => {
    if (!room?.tournament) return null;
    try { return { tournament: applyForfeits(applySubmittedResults(room.tournament, submissions)) }; }
    catch (err) { return { error: err.message }; }
  }, [room, submissions]);

  useEffect(() => {
    if (room?.status === "lobby" && !viewResults) router.replace(`/room/${roomId}`);
  }, [room?.status, roomId, router, viewResults]);

  if (!loading && !user) return <div role="alert" className="p-8 text-red-400 text-center">You could not be signed in. Go back to multiplayer to try again.</div>;
  if (error) return <div role="alert" className="p-8 text-red-400 text-center">{error}</div>;
  if (room && !isMember) return <div role="alert" className="p-8 text-red-400 text-center">You are not in this room.</div>;
  if (resolved?.error) return <div role="alert" className="p-8 text-red-400 text-center">{resolved.error}</div>;
  if (room?.status === "lobby" && !viewResults) return <div className="p-8 text-white text-center">Returning to lobby...</div>;
  if (!room || !room.tournament || resultsLoaded !== activeTournamentId) {
    return <div className="p-8 text-white text-center">Loading Multiplayer Tournament...</div>;
  }

  const { stage, swissRound, standings, matches } = resolved.tournament;
  const isHost = room.hostId === user?.uid;

  const effectiveStage = stage;

  const myPlayerObj = room.players?.find(p => p.uid === user?.uid);
  const mySquad = myPlayerObj?.squad || [];
  const teamName = myPlayerObj?.teamName || "My Team";

  const tournamentId = room.tournament.tournamentId;
  const checkCurrent = (data, hostOnly = false) => {
    if (!user?.uid || auth.currentUser?.uid !== user.uid || data.status !== "playing" || !tournamentId || data.tournament?.tournamentId !== tournamentId) throw new Error("This Major is no longer active.");
    if (!Object.values(data.players || {}).some(p => p.uid === user.uid && !p.left)) throw new Error("You are not in this room.");
    if (hostOnly && data.hostId !== user.uid) throw new Error("Only the host can advance the Major.");
    return data.tournament;
  };

  const completeMatch = async (matchId, result) => {
    const roomRef = doc(db, "rooms", roomId);
    return runTransaction(db, async tx => {
      const snap = await tx.get(roomRef);
      if (!snap.exists()) throw new Error("Room not found.");
      const t = checkCurrent(snap.data());
      const index = t.matches.findIndex(m => m.id === matchId);
      const match = t.matches[index];
      if (!match || !match.playerUids?.includes(user.uid)) throw new Error("You cannot submit this match.");
      const ref = doc(roomRef, 'results', matchResultId(tournamentId, matchId));
      const submitted = await tx.get(ref);
      if (match.completed) return match.result;
      if (submitted.exists()) return submitted.data().result;
      if (t.abandonedUids?.some(uid => match.playerUids?.includes(uid))) throw new Error("This match was decided by an abandonment.");
      if (!t.matchesStarted || !validMatchResult(match, result)) throw new Error("Invalid match result.");
      // shortcut: rebuild display stats from the replay; persist separately if cross-version match history is needed.
      tx.set(ref, { tournamentId, matchId, matchIndex: index, submittedBy: user.uid,
        result: { ...result, teamA: match.teamA, teamB: match.teamB,
          maps: result.maps.map(({ map, scoreA, scoreB, winnerId }) => ({ map, scoreA, scoreB, winnerId })) } });
      return result;
    });
  };

  const readSubmittedResults = async (tx, tournament) => {
    const pending = tournament.matches.filter(m => m.isPlayerMatch && !m.completed);
    const snapshots = await Promise.all(pending.map(m => tx.get(doc(db, 'rooms', roomId, 'results', matchResultId(tournamentId, m.id)))));
    return applyForfeits(applySubmittedResults(tournament, snapshots.filter(s => s.exists()).map(s => s.data())));
  };

  const startMatches = async () => {
    const roomRef = doc(db, "rooms", roomId);
    await runTransaction(db, async tx => {
      const snap = await tx.get(roomRef);
      if (!snap.exists()) throw new Error("Room not found.");
      const t = checkCurrent(snap.data(), true);
      if (t.stage !== stage || t.swissRound !== swissRound || t.matches.length !== room.tournament.matches.length || !["swiss", "playoffs"].includes(t.stage)) return;
      tx.update(roomRef, { "tournament.matchesStarted": true });
    });
  };

  const advanceStage = async () => {
    const roomRef = doc(db, "rooms", roomId);
    await runTransaction(db, async tx => {
    const snap = await tx.get(roomRef);
    if (!snap.exists()) throw new Error("Room not found.");
    const t = await readSubmittedResults(tx, checkCurrent(snap.data(), true));
    if (t.stage !== stage || t.swissRound !== swissRound || t.matchesStarted !== room.tournament.matchesStarted || t.matches.length !== room.tournament.matches.length || !["swiss", "playoffs"].includes(t.stage)) return;
    const current = t.matches.filter(m => t.stage === "swiss" ? m.round === t.swissRound : ["Quarterfinals", "Semifinals", "Final"].includes(m.round));
    if (current.some(m => m.isPlayerMatch && !m.completed)) throw new Error("A player match is still pending.");
    
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
        tx.update(roomRef, {
          "tournament.matches": updatedMatches,
          "tournament.standings": updatedStandings,
          "tournament.stage": "swiss_complete",
          "tournament.matchesStarted": false
        });
      } else {
        const nextRound = t.swissRound + 1;
        const active = updatedStandings.filter(tm => tm.wins < 3 && tm.losses < 3);
        const newMatches = generateSwissPairings(active, updatedMatches, nextRound);
        
        tx.update(roomRef, {
          "tournament.matches": applyForfeits({ ...t, matches: [...updatedMatches, ...newMatches], standings: updatedStandings }).matches,
          "tournament.standings": applyForfeits({ ...t, matches: [...updatedMatches, ...newMatches], standings: updatedStandings }).standings,
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
        tx.update(roomRef, {
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
        
        tx.update(roomRef, { "tournament.matches": applyForfeits({ ...t, matches: [...updatedMatches, ...sf] }).matches, "tournament.matchesStarted": false });
        return;
      }
      
      if (sfMatches.length === 2 && sfMatches.every(m => m.completed) && !finalMatch) {
        const getWinner = (match) => match.result.winner === match.teamA.id ? match.teamA : match.teamB;
        const fin = { id: 'F_M0', round: 'Final', teamA: getWinner(sfMatches[0]), teamB: getWinner(sfMatches[1]), result: null, completed: false };
        fin.isPlayerMatch = fin.teamA.isPlayer || fin.teamB.isPlayer;
        fin.playerUids = [fin.teamA.uid, fin.teamB.uid].filter(Boolean);
        
        tx.update(roomRef, { "tournament.matches": applyForfeits({ ...t, matches: [...updatedMatches, fin] }).matches, "tournament.matchesStarted": false });
        return;
      }

      tx.update(roomRef, { "tournament.matches": updatedMatches, "tournament.matchesStarted": false });
    }
    });
  };

  const continueToPlayoffs = async () => {
    const roomRef = doc(db, "rooms", roomId);
    await runTransaction(db, async tx => {
    const snap = await tx.get(roomRef);
    if (!snap.exists()) throw new Error("Room not found.");
    const t = checkCurrent(snap.data(), true);
    if (t.stage !== stage || t.swissRound !== swissRound || t.stage !== "swiss_complete") return;
    let qualified = t.standings
      .filter(tm => tm.wins >= 3)
      .sort((a, b) => a.losses - b.losses);
      
    if (qualified.length < 8) {
      const qualifiedIds = new Set(qualified.map(tm => tm.id));
      const remaining = t.standings
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
    
    tx.update(roomRef, {
      "tournament.stage": "playoffs",
      "tournament.matches": applyForfeits({ ...t, matches: [...t.matches, ...qfMatches] }).matches,
      "tournament.matchesStarted": false
    });
    });
  };

  const showFinalResult = () => {
    setPendingResult(null);
  };

  const contextValue = {
    isMultiplayer: true,
    isHost,
    roomId,
    tournamentId,
    isArchived: room.status === "lobby",
    returnToLobby: () => returnRoomToLobby(roomId, user.uid),
    userUid: user?.uid,
    mySquad,
    teamName,
    stage: effectiveStage,
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
