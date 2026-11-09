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
import { useTournament } from "@/context/TournamentContext";
import { PLAYOFF_ROUNDS, majorHeading, placement, record } from "@/lib/majorDisplay.mjs";

const isMine = m => Boolean(m.isPlayerMatch);
const isMineTeam = t => Boolean(t?.isPlayer);

export default function SimulationPage() {
  const { ready, stage, pendingResult, swissRound, standings, matches, matchProgress, advanceRound, continueToPlayoffs } = useTournament();
  const router = useRouter();
  const [rosterTeam, setRosterTeam] = useState(null);

  const currentRoundMatches = matches.filter(m => stage === "swiss" ? m.round === swissRound : PLAYOFF_ROUNDS.includes(m.round));
  const playerMatch = currentRoundMatches.find(m => m.isPlayerMatch && !m.completed);

  // Rounds without a player match resolve on their own.
  useEffect(() => {
    if (!standings || standings.length === 0) return;
    if (["swiss", "playoffs"].includes(stage) && !playerMatch) advanceRound();
  }, [stage, playerMatch, advanceRound, standings]);

  if (!ready) return <><AppBar /><main className="p-6 text-ink-2">Loading…</main></>;
  if (!standings || standings.length === 0) return <><AppBar />
    <main className="mx-auto w-full max-w-[1440px] px-4 py-16 sm:px-6">
      <h1 className="text-[24px] font-medium">No Major in progress</h1>
      <p className="mt-2 text-ink-2">Start one from your organization.</p>
      <Link className="btn btn-primary btn-lg mt-6" href="/organization">Go to organization</Link>
    </main></>;

  const me = standings.find(t => t.isPlayer);
  const hasPlayoffs = matches.some(m => typeof m.round === "string");
  const [title, subtitle] = majorHeading(stage, swissRound, matches);
  const resuming = playerMatch && matchProgress?.[playerMatch.id];

  let lead = null;
  if (["swiss", "playoffs"].includes(stage) && playerMatch) {
    lead = <MatchupCard match={playerMatch} isMineTeam={isMineTeam} label="Your match" onTeamClick={setRosterTeam}>
      <Link href={`/simulation/match?id=${encodeURIComponent(playerMatch.id)}`} className="btn btn-primary btn-lg">{resuming ? "Resume match" : "Play match"}</Link>
    </MatchupCard>;
  } else if (stage === "swiss_complete") {
    lead = <section className="card p-6">
      <h2 className="text-[24px] font-medium">Through to the playoffs</h2>
      <p className="tabular mt-1 text-ink-2">{me.name} finished the Swiss stage {record(me)}.</p>
      <button type="button" onClick={continueToPlayoffs} className="btn btn-primary btn-lg mt-6">Continue to playoffs</button>
    </section>;
  } else if (["results_pending", "won", "eliminated"].includes(stage)) {
    const place = placement(me, matches);
    lead = <ResultPanel title={stage === "won" || pendingResult === "won" ? "Major champions" : place.text} teams={[{ ...me, placement: place }]}
      onTeamClick={setRosterTeam}>
      <button type="button" onClick={() => router.push("/organization")} className="btn btn-primary btn-lg">Back to organization</button>
    </ResultPanel>;
  }

  return <>
    <AppBar />
    <main className="mx-auto grid w-full max-w-[1440px] grid-cols-1 gap-6 px-4 py-8 sm:px-6">
      <header className="flex items-baseline gap-3">
        <h1 className="text-[20px] font-medium">{title}</h1>
        {subtitle && <span className="meta">{subtitle}</span>}
      </header>
      {lead}
      {hasPlayoffs
        ? <PlayoffBracket matches={matches} isMine={isMine} onTeamClick={setRosterTeam} />
        : <SwissBoard matches={matches} swissRound={swissRound} isMine={isMine} onTeamClick={setRosterTeam} />}
      <StandingsTable standings={standings} matches={matches} isMine={isMineTeam} onTeamClick={setRosterTeam} />
    </main>
    <TeamRosterModal team={rosterTeam} onClose={() => setRosterTeam(null)} />
  </>;
}
