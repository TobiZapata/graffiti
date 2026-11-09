import PlayerIdentity from "@/components/PlayerIdentity";
import { sameDraftPlayer } from "@/lib/draftState.mjs";
import { draftPlayerStat } from "./draftFlow.mjs";

// Three rolled rosters side by side; each player is one click away.
export default function DraftBoard({ teams, pickedPlayers, onPick, selectedTeamId = null, onSelectTeam }) {
  const choosingTeam = onSelectTeam && selectedTeamId == null;
  const visibleTeams = onSelectTeam && !choosingTeam ? teams.filter(team => team.id === selectedTeamId) : teams;
  return (
    <ul className={`grid gap-4 ${visibleTeams.length > 1 ? "md:grid-cols-3" : "max-w-[640px]"}`}>
      {visibleTeams.map(team => (
        <li key={team.id} className={choosingTeam ? "" : "card p-5"}>
          {choosingTeam ? <button type="button" aria-label={`Choose ${team.name}, ${team.major}`} onClick={() => onSelectTeam(team.id)}
            className="card flex h-full w-full cursor-pointer flex-col p-6 text-left transition-colors hover:bg-raised focus-visible:outline-2 focus-visible:outline-ink">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={team.icon} alt="" width="96" height="96" className="mb-5 h-24 w-24 object-contain" />
            <span className="text-[24px] font-medium leading-tight">{team.name}</span>
            <span className="meta mt-2">{team.major}</span>
            <span className="mt-6 grid gap-2 text-[13px] text-ink-2">{team.players.map(player => <span key={player.id} className={pickedPlayers.some(other => sameDraftPlayer(player, other)) ? "opacity-40" : ""}><PlayerIdentity player={player} /></span>)}</span>
          </button> : <>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-raised p-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={team.icon} alt="" className="max-h-full max-w-full object-contain" />
            </span>
            <span className="min-w-0">
              <span className="block text-[16px] font-medium">{team.name}</span>
              <span className="meta block">{team.major}</span>
            </span>
          </div>
          <ul className="mt-4" aria-label={`${team.name} roster`}>
            {team.players.map(player => {
              const picked = pickedPlayers.some(other => sameDraftPlayer(player, other));
              return (
                <li key={player.id}>
                  <button type="button" disabled={picked || choosingTeam} onClick={() => onPick(player, team)}
                    className={`-mx-2 flex min-h-16 w-[calc(100%+16px)] items-center gap-3 rounded-lg px-2 text-left transition-colors ${choosingTeam ? "cursor-default" : "hover:bg-raised"} ${picked ? "opacity-40" : ""} disabled:hover:bg-transparent`}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium"><PlayerIdentity player={player} /></span>
                      {!choosingTeam && <span className="mt-1 block text-[12px] tabular text-ink-2">{draftPlayerStat(player, team)}</span>}
                    </span>
                    {picked && <span className="text-ink-3">In squad</span>}
                  </button>
                </li>
              );
            })}
          </ul>
          </>}
        </li>
      ))}
    </ul>
  );
}
