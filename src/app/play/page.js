"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import teams from "@/data/teams.json";
import AppBar from "@/components/AppBar";
import DraftBoard from "@/components/play/DraftBoard";
import SquadPanel from "@/components/play/SquadPanel";
import LogoCreator from "@/components/play/LogoCreator";
import { useTournament } from "@/context/TournamentContext";
import { playerOverall } from "@/lib/majorDisplay.mjs";
import { draftOffer, readDraft, removePick } from "@/lib/draftState.mjs";

const DRAFT_KEY = "major-mvp:draft:v1";
const REROLLS = 3;

// Suggested roles from the drafted players' own data; the player can change any of them.
function suggestRoles(squad) {
  const ids = squad.map((_, i) => String(i));
  const byRole = role => ids.find(i => String(squad[i].player.role).toUpperCase() === role);
  const awper = byRole("AWPER") ?? "";
  const igl = ids.find(i => i !== awper && String(squad[i].player.role).toUpperCase() === "IGL") ?? "";
  const star = ids.reduce((best, i) => best === "" || (playerOverall(squad[i].player) ?? 0) > (playerOverall(squad[best].player) ?? 0) ? i : best, "");
  return { mainAwperUid: awper, iglUid: igl, starUid: star };
}

function loadDraft() {
  try {
    return readDraft(JSON.parse(sessionStorage.getItem(DRAFT_KEY)), teams);
  } catch { /* A missing or unreadable draft starts fresh. */ }
  return null;
}

export default function PlayPage() {
  const router = useRouter();
  const { organization, ready, storageError, createOrganization } = useTournament();
  const [draft] = useState(() => typeof window === "undefined" ? null : loadDraft());
  const [draftState, setDraftState] = useState(() => ({ squad: draft?.squad ?? [], rerollsLeft: draft?.rerollsLeft ?? REROLLS, seed: draft?.seed ?? Math.random().toString(36).slice(2) }));
  const { squad, rerollsLeft, seed } = draftState;
  const rolledTeams = draftOffer(seed, squad.length, rerollsLeft, teams).map(id => teams.find(team => team.id === id));
  const [roles, setRoles] = useState(() => draft?.squad?.length === 5 ? suggestRoles(draft.squad) : { mainAwperUid: "", iglUid: "", starUid: "" });
  const [teamName, setTeamName] = useState("");
  const [teamIcon, setTeamIcon] = useState("");
  const [colors, setColors] = useState(["#1e293b", "#38bdf8"]);
  const [error, setError] = useState("");

  useEffect(() => {
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draftState)); }
    catch { /* The draft still works without session storage. */ }
  }, [draftState]);

  const pickedNames = new Set(squad.map(s => s.player.name.toLowerCase()));
  const complete = squad.length >= 5;

  function pick(player, team) {
    const next = [...squad, { player, team: { name: team.name, major: team.major } }];
    setDraftState({ ...draftState, squad: next });
    if (next.length === 5) setRoles(suggestRoles(next));
  }

  function remove(index) {
    setDraftState(removePick(draftState, index));
    setRoles({ mainAwperUid: "", iglUid: "", starUid: "" });
  }

  function reroll() {
    if (rerollsLeft < 1) return;
    setDraftState({ ...draftState, rerollsLeft: rerollsLeft - 1 });
  }

  const missing = [
    !teamName.trim() && "a name",
    !roles.mainAwperUid && "an AWPer",
    !roles.iglUid && "an IGL",
    !roles.starUid && "a star player",
    roles.mainAwperUid && roles.mainAwperUid === roles.iglUid && "different players as AWPer and IGL",
  ].filter(Boolean);

  function create() {
    try {
      const result = createOrganization({ name: teamName.trim(), icon: teamIcon, colors, squad, ...roles });
      if (result === false) throw new Error();
      try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* Nothing to clean up. */ }
      router.push("/organization");
    } catch {
      setError("The organization could not be created. Check the details and try again.");
    }
  }

  if (!ready) return <><AppBar /><main className="p-6 text-ink-2">Loading…</main></>;
  if (storageError) return <><AppBar /><main className="p-6 text-negative" role="alert">{storageError}</main></>;
  if (organization) return <><AppBar /><main className="mx-auto max-w-[1440px] p-6">
    <p>You already have an organization. <Link className="underline" href="/organization">Go to {organization.name}</Link></p>
  </main></>;

  return (
    <>
      <AppBar />
      <main className="mx-auto grid w-full max-w-[1440px] gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          {complete ? (
            <section aria-labelledby="org-title" className="max-w-[560px]">
              <h1 id="org-title" className="text-[20px] font-medium">Name your organization</h1>
              <p className="mt-1 text-ink-2">Roles are suggested from your players. You can change them later from the organization page.</p>

              <div className="card mt-6 grid gap-6 p-6">
                <div>
                  <label htmlFor="team-name" className="label">Name</label>
                  <input id="team-name" type="text" value={teamName} onChange={e => setTeamName(e.target.value)} maxLength={20} className="field" autoComplete="off" />
                </div>
                <LogoCreator onChange={setTeamIcon} onColorsChange={setColors} />
                <div className="grid gap-4 sm:grid-cols-3">
                  {[["mainAwperUid", "AWPer"], ["iglUid", "IGL"], ["starUid", "Star player"]].map(([field, label]) => (
                    <label key={field}>
                      <span className="label">{label}</span>
                      <select value={roles[field]} onChange={e => { const value = e.target.value; setRoles(current => ({ ...current, [field]: value })); }} className="field">
                        <option value="">Choose</option>
                        {squad.map((entry, index) => <option key={entry.player.name} value={String(index)}>{entry.player.name}</option>)}
                      </select>
                    </label>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-4">
                <button type="button" disabled={missing.length > 0} onClick={create} className="btn btn-primary btn-lg">Create organization</button>
                {missing.length > 0 && <p className="text-ink-2" role="status">Still needed: {missing.join(", ")}</p>}
              </div>
              {error && <p role="alert" className="mt-4 text-negative">{error}</p>}
            </section>
          ) : (
            <section aria-labelledby="draft-title">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h1 id="draft-title" className="text-[20px] font-medium">Draft · <span className="tabular">player {squad.length + 1} of 5</span></h1>
                  <p className="mt-1 text-ink-2">Pick one player from any of these rosters. A new set of teams comes up after each pick.</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="meta tabular">{rerollsLeft} {rerollsLeft === 1 ? "reroll" : "rerolls"} left for this draft</span>
                  <button type="button" onClick={reroll} disabled={rerollsLeft < 1} className="btn btn-secondary">Reroll teams</button>
                </div>
              </div>
              <div className="mt-6">
                <DraftBoard teams={rolledTeams} pickedNames={pickedNames} onPick={pick} />
              </div>
              <p className="meta mt-3">Numbers are each player&apos;s overall: the average of aim, game sense, positioning, utility, clutch, entry, aggression and composure.</p>
            </section>
          )}
        </div>

        <SquadPanel squad={squad} roles={complete ? roles : {}} onRemove={remove} />
      </main>
    </>
  );
}
