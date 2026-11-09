"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppBar from "@/components/AppBar";
import TeamRosterModal from "@/components/TeamRosterModal";
import SwissBoard from "@/components/major/SwissBoard";
import PlayoffBracket from "@/components/major/PlayoffBracket";
import StandingsTable from "@/components/major/StandingsTable";
import MatchupCard from "@/components/major/MatchupCard";
import ResultPanel from "@/components/major/ResultPanel";
import { useMultiplayerTournament } from "@/context/MultiplayerContext";
import { PLAYOFF_ROUNDS, majorHeading, placement, teamLabel } from "@/lib/majorDisplay.mjs";

export default function SimulationUI() {
  const [rosterTeam, setRosterTeam] = useState(null);
  const [actionError, setActionError] = useState(null);
  const {
    stage, swissRound, standings, matches, advanceRound, continueToPlayoffs,
    isHost, roomId, userUid, matchesStarted, startMatches, returnToLobby, isArchived,
  } = useMultiplayerTournament();
  const router = useRouter();

  const currentRoundMatches = (matches || []).filter(m => stage === "swiss" ? m.round === swissRound : PLAYOFF_ROUNDS.includes(m.round));
  const myMatch = currentRoundMatches.find(m => m.playerUids?.includes(userUid) && !m.completed);
  const anyHumanMatchPending = currentRoundMatches.some(m => m.isPlayerMatch && !m.completed);

  // Once the host starts the round, everyone with a match goes to it.
  useEffect(() => {
    if (matchesStarted && myMatch && !myMatch.completed) router.push(`/room/${roomId}/match?id=${myMatch.id}`);
  }, [matchesStarted, myMatch, roomId, router]);

  // When every human match of the round is in, the host's screen advances the round.
  useEffect(() => {
    if (isHost && ["swiss", "playoffs"].includes(stage) && matchesStarted && !anyHumanMatchPending) {
      advanceRound().catch(err => setActionError(err.message));
    }
  }, [stage, anyHumanMatchPending, isHost, advanceRound, matchesStarted]);

  const run = action => () => action().catch(err => setActionError(err.message));
  const roomLink = <Link href={`/room/${roomId}`} className="link tabular">Room {roomId}</Link>;

  if (!standings || standings.length === 0) return <><AppBar>{roomLink}</AppBar><main className="p-6 text-ink-2">Loading the Major…</main></>;

  const isMine = m => Boolean(m.playerUids?.includes(userUid));
  const isMineTeam = t => t?.uid === userUid;
  const hasPlayoffs = matches.some(m => typeof m.round === "string");
  const [title, subtitle] = majorHeading(stage, swissRound, matches);
  const lobbyButton = (
    <button type="button" disabled={!isHost && !isArchived} className="btn btn-primary btn-lg"
      onClick={() => isArchived ? router.push(`/room/${roomId}`) : run(returnToLobby)()}>
      {isArchived || isHost ? "Back to lobby" : "Waiting for the host to return to the lobby"}
    </button>
  );

  let lead = null;
  if (["swiss", "playoffs"].includes(stage) && !matchesStarted) {
    const hostAction = isHost && (
      <button type="button" className="btn btn-primary btn-lg" onClick={run(anyHumanMatchPending ? startMatches : advanceRound)}>
        {anyHumanMatchPending ? "Start round matches" : "Simulate the remaining matches"}
      </button>
    );
    const waiting = !isHost && <p className="text-ink-2">{anyHumanMatchPending ? "Waiting for the host to start the round" : "Waiting for the host to simulate the remaining matches"}</p>;
    lead = myMatch
      ? <MatchupCard match={myMatch} isMineTeam={isMineTeam} label="Your match" onTeamClick={setRosterTeam}>{hostAction}{waiting}</MatchupCard>
      : <section className="card p-6">
        <h2 className="text-[20px] font-medium">{anyHumanMatchPending ? "You have no match this round" : "Only computer teams play this round"}</h2>
        <div className="mt-4 flex flex-wrap items-center gap-4">{hostAction}{waiting}</div>
      </section>;
  } else if (["swiss", "playoffs"].includes(stage)) {
    lead = <section className="card p-6"><h2 className="text-[20px] font-medium">Round in progress</h2>
      <p className="mt-1 text-ink-2">Waiting for the other players to finish their matches.</p></section>;
  } else if (stage === "swiss_complete") {
    lead = <section className="card p-6">
      <h2 className="text-[24px] font-medium">Swiss stage complete</h2>
      <p className="mt-1 text-ink-2">Eight teams go through to the playoffs.</p>
      {isHost
        ? <button type="button" onClick={run(continueToPlayoffs)} className="btn btn-primary btn-lg mt-6">Continue to playoffs</button>
        : <p role="status" className="mt-6 text-ink-2">Waiting for the host to continue to playoffs.</p>}
    </section>;
  } else if (["results_pending", "won", "eliminated"].includes(stage)) {
    const humans = standings.filter(t => t.isPlayer).map(t => ({ ...t, placement: placement(t, matches) }))
      .sort((a, b) => a.placement.weight - b.placement.weight);
    const final = matches.find(m => m.round === "Final" && m.completed);
    const champion = final && (final.result.winner === final.teamA.id ? final.teamA : final.teamB);
    lead = <ResultPanel title={champion ? `${teamLabel(champion)} won the Major` : "Major finished"} teams={humans}
      onTeamClick={setRosterTeam}>{lobbyButton}</ResultPanel>;
  }

  return <>
    <AppBar>{roomLink}</AppBar>
    <main className="mx-auto grid w-full max-w-[1440px] grid-cols-1 gap-6 px-4 py-8 sm:px-6">
      <header className="flex items-baseline gap-3">
        <h1 className="text-[20px] font-medium">{title}</h1>
        {subtitle && <span className="meta">{subtitle}</span>}
      </header>
      {actionError && <p role="alert" className="text-negative">{actionError}</p>}
      {lead}
      {hasPlayoffs
        ? <PlayoffBracket matches={matches} isMine={isMine} onTeamClick={setRosterTeam} />
        : <SwissBoard matches={matches} swissRound={swissRound} isMine={isMine} onTeamClick={setRosterTeam} />}
      <StandingsTable standings={standings} matches={matches} isMine={isMineTeam} onTeamClick={setRosterTeam} />
    </main>
    <TeamRosterModal team={rosterTeam} onClose={() => setRosterTeam(null)} />
  </>;
}
