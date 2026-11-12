"use client";
import PlayerIdentity from "@/components/PlayerIdentity";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import AppBar from "@/components/AppBar";
import OrganizationAbandonments from "@/components/OrganizationAbandonments";
import { useTournament } from "@/context/TournamentContext";
import { organizationProfile, careerPlayerRating, careerPlayerMatches } from "@/lib/organizationProfile.mjs";
import { rosterPlayerAttribute, ROLE_FIELDS } from "@/lib/majorDisplay.mjs";
import DraftBoard from "@/components/play/DraftBoard";
import teams from "@/data/teams.json";
import { replacementOffer, rosterDepartureMessage } from "@/lib/rosterLifecycle.mjs";
import { useRoomSession } from "@/context/RoomSessionContext";
import { rosterMajorFromRoom } from "@/lib/rosterRoom.mjs";

const outcomes = { active: "In progress", champion: "Champion", finalist: "Runner-up", semifinal: "Semifinals", quarterfinal: "Quarterfinals", swiss: "Out in the Swiss stage" };
const percentage = value => value === null ? "—" : `${Math.round(value)}%`;
const roleDragPrefix = "major-mvp-role:";

function ModeTabs({ value, onChange, label }) {
  return <div className="mt-3 flex gap-2" role="group" aria-label={label}>
    {[["offline", "Offline"], ["online", "Online"]].map(([mode, text]) => <button key={mode} type="button" aria-pressed={value === mode} onClick={() => onChange(mode)} className={`min-h-11 rounded-md border px-3 text-[13px] ${value === mode ? "border-white text-ink" : "border-transparent text-ink-3 hover:text-ink"}`}>{text}</button>)}
  </div>;
}

function RoomReturnLink() {
  const room = useSearchParams().get("room");
  return /^[A-Z0-9]{4}$/.test(room || "") ? <Link href={`/room/${room}`} className="link">Back to room {room}</Link> : null;
}

export default function OrganizationPage() {
  const router = useRouter();
  const roomSession = useRoomSession();
  const { organization, ready, storageError, startOrganizationMajor, assignOrganizationRole, standings, matches, stage, pendingResult, tournamentId, rosterLocked, benchPlayer, swapBenchPlayer, promoteBench, releaseBench, recruitPlayer, acknowledgeRosterNotice } = useTournament();
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [roleNotice, setRoleNotice] = useState("");
  const [confirmRelease, setConfirmRelease] = useState(false);
  const [recordMode, setRecordMode] = useState("offline");
  const [rivalMode, setRivalMode] = useState("offline");
  const roleHelp = useRef(null);
  const departuresDialog = useRef(null);
  const showDepartures = Boolean(ready && organization?.rosterNotice && !organization.rosterNotice.acknowledged);

  useEffect(() => {
    const dialog = departuresDialog.current;
    if (!showDepartures || !dialog) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    return () => { dialog.close(); document.body.style.overflow = previousOverflow; };
  }, [showDepartures]);

  if (!ready) return <><AppBar /><main className="p-6 text-ink-2">Loading…</main></>;
  if (storageError && !organization) return <><AppBar /><main className="p-6 text-negative" role="alert">{storageError}</main></>;
  if (!organization) return <><AppBar />
    <main className="mx-auto w-full max-w-[1440px] px-4 py-16 sm:px-6">
      <h1 className="text-[24px] font-medium">You don&apos;t have an organization yet</h1>
      <p className="mt-2 max-w-[520px] text-ink-2">Draft five players from past Majors, name your organization and take it to your first Major.</p>
      <Link href="/play" className="btn btn-primary btn-lg mt-6">Create organization</Link>
    </main></>;

  const hasTournament = standings.length > 0;
  const finished = ["won", "eliminated"].includes(stage) || (stage === "results_pending" && ["won", "eliminated"].includes(pendingResult));
  const playerMatch = matches.find(match => match.isPlayerMatch && !match.completed);
  const playHref = playerMatch ? `/simulation/match?id=${encodeURIComponent(playerMatch.id)}` : "/simulation";
  const profile = organizationProfile(organization, { tournamentId, stage, pendingResult, matches, standings });
  const onlineMajor = rosterMajorFromRoom(roomSession?.room, roomSession?.userUid, organization, { includeActive: true });
  const recordProfile = organizationProfile(organization, recordMode === "online" ? onlineMajor || {} : { tournamentId, stage, pendingResult, matches, standings }, recordMode);
  const rivalProfile = organizationProfile(organization, rivalMode === "online" ? onlineMajor || {} : { tournamentId, stage, pendingResult, matches, standings }, rivalMode);
  const currentRatingMatches = [...(organization.majorHistory?.some(major => major.id === tournamentId) ? [] : matches), ...(onlineMajor?.matches || [])];
  const founded = new Date(organization.createdAt).getFullYear();
  const locked = rosterLocked || !!storageError || starting;
  const benchUnlocked = (organization.majorHistory?.length ?? 0) > 0;
  const needsReplacement = organization.squad.length < 5;

  async function rosterAction(action, ...args) {
    try { await action(...args); setError(""); }
    catch (e) { setError(e.message || "Roster change failed. Try again."); }
  }

  async function start() {
    setStarting(true); setError("");
    try { await startOrganizationMajor(); router.push("/simulation"); }
    catch (e) { setError(e.message || "The Major could not be started. Try again."); }
    finally { setStarting(false); }
  }

  function moveRole(field, uid) {
    if (!Object.hasOwn(ROLE_FIELDS, field) || storageError || starting) return;
    try {
      assignOrganizationRole(field, uid);
      setRoleNotice(`${ROLE_FIELDS[field]} moved to ${organization.squad[Number(uid)].player.name}.`);
      setError("");
    } catch (e) { setError(e.message); }
    setSelectedRole(null); setDropTarget(null);
  }

  return <>
    <AppBar><Suspense fallback={null}><RoomReturnLink /></Suspense></AppBar>
    <main className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-center gap-4">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-surface p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={organization.icon} alt={`${organization.name} crest`} width="48" height="48" />
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-[28px] font-medium leading-tight">{organization.name}</h1>
          <p className="meta tabular">Founded {Number.isFinite(founded) ? founded : "—"} · {profile.majorsPlayed} {profile.majorsPlayed === 1 ? "Major" : "Majors"} played</p>
        </div>
        <nav aria-label="Play modes" className="flex flex-wrap items-center gap-3 sm:ml-auto">
          {hasTournament && !finished ? <Link href={playHref} className="btn btn-primary btn-lg">Continue singleplayer</Link> :
            <button type="button" className="btn btn-primary btn-lg" onClick={start} disabled={starting || needsReplacement || rosterLocked || !!storageError}>{starting ? "Starting…" : "Singleplayer"}</button>}
          <Link href="/multiplayer" className="btn btn-secondary btn-lg">Multiplayer</Link>
        </nav>
      </header>
      {!(hasTournament && !finished) && (needsReplacement || rosterLocked) && <p className="meta mt-3">{needsReplacement ? "Complete your five-player roster to start a Major." : "Finish your active room before starting a singleplayer Major."}</p>}
      {error && <p role="alert" className="mt-4 text-negative">{error}</p>}
      {showDepartures && <dialog ref={departuresDialog} aria-labelledby="departures-title" aria-modal="true" closedby="none" onCancel={event => event.preventDefault()}
        className="m-auto max-h-[calc(100dvh-32px)] w-[min(560px,calc(100%-32px))] overflow-y-auto rounded-2xl bg-surface p-6 text-ink backdrop:bg-black/80">
        <h2 id="departures-title" className="text-[20px] font-medium">Roster departures</h2>
        <ul className="mt-4 space-y-4 text-ink-2">{organization.rosterNotice.departed.map((entry, index) => <li key={index}>
          <PlayerIdentity player={entry.country ? entry : organization.formerPlayers?.find(slot => slot.player.name === entry.name)?.player ?? entry} />
          {" — "}{rosterDepartureMessage(entry, organization.rosterNotice.majorId)}
        </li>)}</ul>
        {error && <p role="alert" className="mt-4 text-negative">{error}</p>}
        <button type="button" className="btn btn-primary mt-6" onClick={() => rosterAction(acknowledgeRosterNotice)}>Dismiss</button>
      </dialog>}

      <div className={`mt-8 grid items-start gap-4 ${needsReplacement ? "lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]" : "lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"}`}>
        <div className={`grid content-start gap-4 ${needsReplacement ? "order-2 lg:order-1" : ""}`}>
          <section className="card p-6" aria-labelledby="active-roster">
            <header className="flex items-center justify-between gap-4">
              <h2 id="active-roster" className="text-[16px] font-medium">Active roster</h2>
              <button type="button" className="link text-[13px]" aria-haspopup="dialog" onClick={() => roleHelp.current.showModal()}>How roles work</button>
            </header>
            <p className="meta mt-1">Drag a role onto another player, or select the role and then the player.</p>
            <ul className="mt-4">{organization.squad.map((entry, index) => {
              const uid = String(index);
              return <li key={index}
                className={`grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-lg px-3 py-2 transition-colors sm:flex ${dropTarget === uid ? "bg-control" : selectedRole ? "hover:bg-raised" : ""}`}
                data-player-uid={uid}
                onDragOver={e => {
                  if (storageError || starting || !e.dataTransfer.types.includes("text/plain")) return;
                  e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDropTarget(uid);
                }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDropTarget(null); }}
                onDrop={e => {
                  e.preventDefault();
                  const payload = e.dataTransfer.getData("text/plain");
                  if (payload.startsWith(roleDragPrefix)) moveRole(payload.slice(roleDragPrefix.length), uid);
                  setDropTarget(null);
                }}>
                <button type="button" disabled={!selectedRole || !!storageError || starting}
                  className={`min-w-0 flex-1 text-left font-medium ${selectedRole ? "cursor-pointer underline decoration-ink-3 underline-offset-4" : "cursor-default"}`}
                  aria-label={selectedRole ? `Make ${entry.player.name} the ${ROLE_FIELDS[selectedRole]}` : entry.player.name}
                  onClick={() => moveRole(selectedRole, uid)}>
                  <span className="block truncate"><PlayerIdentity player={entry.player} /></span>
                  <span className="block text-[12px] tabular font-normal text-ink-3">{rosterPlayerAttribute(entry.player, organization, uid)}</span>
                </button>
                <span className="col-start-1 row-start-2 flex shrink-0 flex-wrap gap-1 sm:justify-end">
                  {Object.entries(ROLE_FIELDS).filter(([field]) => organization[field] === uid).map(([field, label]) =>
                    <button type="button" key={field} data-role={field} draggable={!storageError && !starting} disabled={!!storageError || starting}
                      className={`h-7 cursor-grab rounded-md px-2 text-[12px] font-medium transition-colors active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50 ${selectedRole === field ? "bg-ink text-black" : "bg-control hover:bg-[#363636]"} ${field === "starUid" && selectedRole !== field ? "text-accent" : ""}`}
                      aria-label={`Move ${label} from ${entry.player.name}`} aria-pressed={selectedRole === field}
                      onClick={() => { setSelectedRole(selectedRole === field ? null : field); setRoleNotice(""); }}
                      onDragStart={e => { e.dataTransfer.setData("text/plain", roleDragPrefix + field); e.dataTransfer.effectAllowed = "move"; setSelectedRole(field); }}
                      onDragEnd={() => { setSelectedRole(null); setDropTarget(null); }}>
                      {label}
                    </button>)}
                </span>
                <span className="col-start-2 row-start-1 flex shrink-0 items-center gap-3 text-right tabular text-[13px]">
                  <span className="meta" aria-label={`${entry.player.name} matches played`}>{careerPlayerMatches(entry, currentRatingMatches)} Matches</span>
                  <span aria-label={`${entry.player.name} average rating`} title="Average match rating">{careerPlayerRating(entry, currentRatingMatches)?.toFixed(2) ?? "—"}<span className="block text-[11px] text-ink-3">Rating</span></span>
                </span>
                {benchUnlocked && (organization.bench ? <button type="button" className="link col-start-2 row-start-2 min-h-11 text-[13px]" disabled={locked} aria-label={`Swap ${entry.player.name} with ${organization.bench.player.name} on the bench`} onClick={() => rosterAction(swapBenchPlayer, index)}>Swap</button> : organization.squad.length === 5 && <button type="button" className="link col-start-2 row-start-2 min-h-11 text-[13px]" disabled={locked || !organization.benchTokens} aria-label={`Bench ${entry.player.name}`} onClick={() => rosterAction(benchPlayer, index)}>Bench</button>)}
              </li>;
            })}</ul>
            <div className="mt-3 min-h-5 text-[13px] text-ink-2" role="status">
              {selectedRole ? <>Choose the new {ROLE_FIELDS[selectedRole]}. <button type="button" className="link underline" onClick={() => { setSelectedRole(null); setDropTarget(null); }}>Cancel</button></> : roleNotice}
            </div>
            <p className="meta mt-1">Role changes apply from the next Major.</p>
            <dialog ref={roleHelp} aria-labelledby="role-help-title" onClick={e => { if (e.target === e.currentTarget) roleHelp.current.close(); }}
              className="m-auto w-[min(480px,calc(100%-32px))] rounded-2xl bg-surface p-6 text-ink backdrop:bg-black/70">
              <header className="flex items-center justify-between gap-4">
                <h2 id="role-help-title" className="text-[16px] font-medium">How roles work</h2>
                <button type="button" className="link" aria-label="Close" onClick={() => roleHelp.current.close()}>Close</button>
              </header>
              <dl className="mt-4 grid gap-4">
                <div><dt className="font-medium">AWPer</dt><dd className="mt-1 text-ink-2">Gets first claim on the AWP when the team can afford it.</dd></div>
                <div><dt className="font-medium">IGL</dt><dd className="mt-1 text-ink-2">The in-game leader. Their leadership shifts the team&apos;s chances of winning.</dd></div>
                <div><dt className="font-medium">Star player</dt><dd className="mt-1 text-ink-2">The face of your organization. Your designated star never leaves in the post-Major departure draw.</dd></div>
              </dl>
              <p className="mt-4 text-ink-2">The AWPer and IGL can be the same player. The star can share either role.</p>
              <p className="meta mt-4">A Major in progress keeps the roles it started with.</p>
            </dialog>
          </section>
          <section className="card p-6" aria-labelledby="bench-title">
            <h2 id="bench-title" className="text-[16px] font-medium">Bench</h2>
            <p className="meta mt-1">Bench tokens: {organization.benchTokens ?? 0}. Moving a player to an empty bench uses one token. Swaps and promotions are free between Majors.</p>
            {!benchUnlocked ? <p className="mt-3 text-ink-2">The bench unlocks after your first completed Major.</p> : organization.bench ? <>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><div><PlayerIdentity player={organization.bench.player} /><p className="meta mt-1">{organization.bench.benchMajors ? "Will leave after the next Major if benched again." : "May remain benched for one Major."}</p></div>
                <div className="flex flex-wrap gap-3">{organization.squad.length < 5 && <button type="button" className="link min-h-11" disabled={locked} aria-label={`Promote ${organization.bench.player.name} from the bench`} onClick={() => rosterAction(promoteBench)}>Promote</button>}
                  {!confirmRelease && <button type="button" className="link min-h-11" disabled={locked} aria-label={`Release ${organization.bench.player.name}`} onClick={() => setConfirmRelease(true)}>Release</button>}</div>
              </div>
              {confirmRelease && <div className="mt-3" role="group" aria-label={`Confirm release of ${organization.bench.player.name}`}><p className="text-ink-2">Release {organization.bench.player.name} from your organization?</p><div className="mt-2 flex gap-4"><button type="button" className="link min-h-11 text-negative" disabled={locked} onClick={() => { rosterAction(releaseBench); setConfirmRelease(false); }}>Confirm release</button><button type="button" className="link min-h-11" onClick={() => setConfirmRelease(false)}>Cancel</button></div></div>}
            </> : <p className="mt-3 text-ink-2">No player on the bench.</p>}
            {locked && <p className="meta mt-3">Roster changes are locked during a Major or active room.</p>}
          </section>
        </div>

        <div className={`grid content-start gap-4 ${needsReplacement ? "order-1 lg:order-2" : ""}`}>
          {needsReplacement ? <section aria-labelledby="recruit-title">
            <h2 id="recruit-title" className="text-[16px] font-medium">Recruit a player</h2>
            <p className="mt-1 text-ink-2">Choose a player to fill your roster. A new selection appears after each pick.</p>
            {locked ? <p className="meta mt-3">Recruitment is locked during a Major or active room.</p> : <div className="mt-4 [&>ul>li>div]:flex-wrap"><DraftBoard teams={replacementOffer(organization, teams).map(id => teams.find(team => team.id === id)).filter(Boolean)} pickedPlayers={[...organization.squad, ...(organization.bench ? [organization.bench] : [])].map(entry => entry.player)} onPick={(player, team) => rosterAction(recruitPlayer, player, team)} /></div>}
          </section> : <>
          <section className="card p-6" aria-labelledby="record-title">
            <h2 id="record-title" className="text-[16px] font-medium">Record</h2>
            <ModeTabs value={recordMode} onChange={setRecordMode} label="Record mode" />
            {recordMode === "online" && <dl className="mt-4"><OrganizationAbandonments organizationId={organization.id} /></dl>}
            {recordProfile.matchesPlayed === 0 ? (
              <p className="mt-2 text-ink-2">No matches played yet. Your record starts with your first match.</p>
            ) : <>
              <dl className="mt-4 grid grid-cols-3 gap-4">
                <div><dt className="meta">Win rate</dt><dd className="tabular mt-1 text-[24px] font-medium">{percentage(recordProfile.winrate)}</dd></div>
                <div><dt className="meta">Matches</dt><dd className="tabular mt-1 text-[24px] font-medium">{recordProfile.matchesPlayed}</dd></div>
                <div><dt className="meta">Titles</dt><dd className={`tabular mt-1 text-[24px] font-medium ${recordProfile.championships ? "text-accent" : ""}`}>{recordProfile.championships}</dd></div>
              </dl>
              <h3 className="meta mt-6">Recent Majors</h3>
              <ol className="mt-2">{recordProfile.recentMajors.map(major => (
                <li key={major.id} className="flex h-9 items-center border-t border-rule">
                  <span className={major.outcome === "champion" ? "text-accent" : ""}>{outcomes[major.outcome]}</span>
                </li>
              ))}</ol>
              <p className="meta mt-3 tabular">{recordProfile.finals} {recordProfile.finals === 1 ? "final" : "finals"} reached</p>
            </>}
          </section>

          <section className="card p-6" aria-labelledby="former-players">
            <h2 id="former-players" className="text-[16px] font-medium">Former players</h2>
            <p className="meta mt-1">The five former players with the most matches for your organization.</p>
            {organization.formerPlayers?.length ? <ul className="mt-3">{organization.formerPlayers.map((entry, index) => <li key={index} className="flex min-h-14 items-center justify-between gap-3 border-t border-rule"><PlayerIdentity player={entry.player} /><span className="flex shrink-0 items-center gap-3 tabular text-[13px]"><span className="meta">{entry.gamesPlayed} Matches</span><span aria-label={`${entry.player.name} average rating`}>{careerPlayerRating(entry)?.toFixed(2) ?? "—"}</span></span></li>)}</ul> : <p className="mt-2 text-ink-2">Players who leave your roster will appear here with their organization stats.</p>}
          </section>
          </>}

          <section className="card p-6" aria-labelledby="rivalries">
            <h2 id="rivalries" className="text-[16px] font-medium">Rivalries</h2>
            <ModeTabs value={rivalMode} onChange={setRivalMode} label="Rivalries mode" />
            {rivalProfile.rivals.length ? <div className="mt-2 overflow-x-auto"><table className="w-full text-left">
              <thead><tr className="meta h-9"><th scope="col" className="font-normal">Team</th><th scope="col" className="text-right font-normal">Played</th><th scope="col" className="text-right font-normal">Win rate</th></tr></thead>
              <tbody>{rivalProfile.rivals.map(rival => <tr key={rival.key} className="border-t border-rule">
                <th scope="row" className="py-3 pr-3 font-normal"><span className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={rival.icon || teams.find(team => team.name === rival.name && team.major === rival.major)?.icon || "/favicon.ico"} alt="" width="28" height="28" className="h-7 w-7 shrink-0 object-contain" />
                  <span>{rival.name}{rival.major && <span className="mt-1 block text-[12px] text-ink-3">{rival.major}</span>}</span>
                </span></th><td className="tabular text-right">{rival.matches}</td><td className="tabular text-right">{percentage(rival.winrate)}</td>
              </tr>)}</tbody>
            </table></div> : <p className="mt-2 text-ink-2">Your five most-played opponents in this mode will appear here.</p>}
          </section>
        </div>
      </div>
      <p className="meta mt-8">Saved in this browser.</p>
    </main>
  </>;
}
