"use client";

import Link from "next/link";
import teams from "@/data/teams.json";
import { useTournament } from "@/context/TournamentContext";
import { record } from "@/lib/majorDisplay.mjs";

const MAJORS = [...new Set(teams.map(t => t.major))];
const LOGOS = [...new Map(teams.map(t => [t.icon, t])).values()].slice(0, 24);

function majorStatus({ standings, stage, swissRound, pendingResult }) {
  const me = standings.find(t => t.isPlayer);
  if (!me) return "No Major in progress";
  if (stage === "won" || pendingResult === "won") return "Major champions";
  if (stage === "eliminated" || pendingResult === "eliminated") return `Eliminated · ${record(me)}`;
  if (stage === "swiss") return `Swiss stage, round ${swissRound} · ${record(me)}`;
  if (stage === "swiss_complete") return `Qualified for the playoffs · ${record(me)}`;
  return "Playoffs";
}

export default function Home() {
  const tournament = useTournament();
  const { organization, ready } = tournament;

  return (
    <main className="flex min-h-screen flex-col">
      <header className="mx-auto flex h-14 w-full max-w-[1440px] items-center px-4 sm:px-6">
        <span className="text-[15px] font-semibold">CS Major Simulator</span>
      </header>

      <section className="mx-auto grid w-full max-w-[1440px] flex-1 items-center gap-12 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-20">
        <div className="max-w-[600px]">
          <h1 className="text-[24px] font-medium leading-[1.15] tracking-[-0.01em] sm:text-[32px]">
            Draft a squad from past Majors and play your own
          </h1>
          <p className="mt-4 text-[16px] leading-relaxed text-ink-2">
            Pick from the rosters of {MAJORS.slice(0, -1).join(", ")} and {MAJORS.at(-1)}. Take five players through a 16-team Swiss stage and the playoffs, and watch every round on the Mirage radar.
          </p>

          {!ready ? <div className="mt-8 h-11" aria-hidden="true" /> : organization ? (
            <div className="mt-8">
              <Link href="/organization" className="card flex items-center gap-4 p-4 transition-colors hover:bg-raised">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={organization.icon} alt="" width="48" height="48" />
                <span className="min-w-0">
                  <span className="block truncate text-[16px] font-medium">{organization.name}</span>
                  <span className="meta tabular">{majorStatus(tournament)}</span>
                </span>
              </Link>
              <div className="mt-6 flex flex-wrap items-center gap-6">
                <Link href="/organization" className="btn btn-primary btn-lg">Continue</Link>
                <Link href="/multiplayer" className="link">Play with friends</Link>
              </div>
            </div>
          ) : (
            <div className="mt-8 flex flex-wrap items-center gap-6">
              <Link href="/play" className="btn btn-primary btn-lg">Create organization</Link>
              <Link href="/multiplayer" className="link">Play with friends</Link>
            </div>
          )}
        </div>

        <figure>
          <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6" aria-label="Teams in the draft pool">
            {LOGOS.map(team => (
              <li key={team.icon} className="card flex aspect-square items-center justify-center p-3" title={team.name}>
                {/* Team logos are served from the team-logo CDN. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={team.icon} alt={team.name} className="max-h-full max-w-full object-contain" loading="lazy" />
              </li>
            ))}
          </ul>
          <figcaption className="meta mt-3">{teams.length} rosters from {MAJORS.length} Majors, 2013–2014</figcaption>
        </figure>
      </section>
    </main>
  );
}
