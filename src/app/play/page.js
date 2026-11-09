"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import teams from "@/data/teams.json";
import legacyTeams from "@/data/teams-legacy.json";
import AppBar from "@/components/AppBar";
import DraftBoard from "@/components/play/DraftBoard";
import SquadPanel from "@/components/play/SquadPanel";
import LogoCreator from "@/components/play/LogoCreator";
import { useTournament } from "@/context/TournamentContext";
import { playerOverall } from "@/lib/majorDisplay.mjs";
import { draftOffer } from "@/lib/draftState.mjs";
import { restoreDraft, selectDraftTeam, pickDraftPlayer } from "@/components/play/draftFlow.mjs";

const DRAFT_KEY = "major-mvp:draft:v1";
const REROLLS = 3;

// Suggested roles from the drafted players' own data; the player can change any of them.
function suggestRoles(squad) {
  const ids = squad.map((_, i) => String(i));
  const byRole = role => ids.find(i => String(squad[i].player.role).toUpperCase() === role);
  const best = field => ids.reduce((best, i) => best === "" || (squad[i].player[field] ?? -1) > (squad[best].player[field] ?? -1) ? i : best, "");
  const awper = squad.some(s => Number.isFinite(s.player.awp)) ? best("awp") : byRole("AWPER") ?? "";
  const igl = squad.some(s => Number.isFinite(s.player.igl)) ? best("igl") : byRole("IGL") ?? "";
  const combat = p => Math.max(p.awp ?? 0, p.rifler ?? 0, playerOverall(p) ?? 0);
  const star = ids.reduce((best, i) => best === "" || combat(squad[i].player) > combat(squad[best].player) ? i : best, "");
  return { mainAwperUid: awper, iglUid: igl, starUid: star };
}

function loadDraft() {
  try {
    return restoreDraft(JSON.parse(sessionStorage.getItem(DRAFT_KEY)), teams, legacyTeams);
  } catch { /* A missing or unreadable draft starts fresh. */ }
  return null;
}

export default function PlayPage() {
  const router = useRouter();
  const { organization, ready, storageError, createOrganization } = useTournament();
  const [draft] = useState(() => typeof window === "undefined" ? null : loadDraft());
  const [draftState, setDraftState] = useState(() => ({ squad: draft?.squad ?? [], rerollsLeft: draft?.rerollsLeft ?? REROLLS, seed: draft?.seed ?? Math.random().toString(36).slice(2), selectedTeamId: draft?.selectedTeamId ?? null }));
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

  const complete = squad.length >= 5;

  function pick(player, team) {
    const next = pickDraftPlayer(draftState, player, team);
    if (next === draftState) return;
    setDraftState(next);
    if (next.squad.length === 5) setRoles(suggestRoles(next.squad));
  }

  function reroll() {
    if (rerollsLeft < 1 || draftState.selectedTeamId != null) return;
    setDraftState({ ...draftState, rerollsLeft: rerollsLeft - 1 });
  }

  const missing = [
    !teamName.trim() && "a name",
    !roles.mainAwperUid && "an AWPer",
    !roles.iglUid && "an IGL",
    !roles.starUid && "a star player",
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
      <main className="mx-auto grid w-full max-w-[1440px] gap-8 px-4 py-8 sm:px-6">
        <div className="min-w-0">
          {complete ? (
            <section aria-labelledby="org-title" className="mx-auto w-full max-w-[640px]">
              <h1 id="org-title" className="text-[20px] font-medium">Name your organization</h1>
              <p className="mt-1 text-ink-2">Roles are suggested from your players. You can change them later from the organization page.</p>

              <div className="card mt-6 grid gap-6 p-6">
                <div>
                  <label htmlFor="team-name" className="label">Name</label>
                  <input id="team-name" type="text" value={teamName} onChange={e => setTeamName(e.target.value)} maxLength={28} className="field" autoComplete="off" />
                </div>
                <LogoCreator onChange={setTeamIcon} onColorsChange={setColors} />
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
                  <p className="mt-1 text-ink-2">Choose a team, then pick one of its players. A new set of teams comes up after each pick.</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="meta tabular">{rerollsLeft} {rerollsLeft === 1 ? "reroll" : "rerolls"} left for this draft</span>
                  <button type="button" onClick={reroll} disabled={rerollsLeft < 1 || draftState.selectedTeamId != null} className="btn btn-secondary">Reroll teams</button>
                </div>
              </div>
              <div className="mt-6">
                <DraftBoard selectedTeamId={draftState.selectedTeamId} onSelectTeam={id => setDraftState(current => selectDraftTeam(current, id, teams))} teams={rolledTeams} pickedPlayers={squad.map(s => s.player)} onPick={pick} />
              </div>
            </section>
          )}
        </div>

        <div className={complete ? "mx-auto w-full max-w-[640px]" : ""}><SquadPanel squad={squad} roles={complete ? roles : null} onRoleChange={complete ? (field, uid) => setRoles(current => ({ ...current, [field]: uid })) : null} /></div>
      </main>
    </>
  );
}
