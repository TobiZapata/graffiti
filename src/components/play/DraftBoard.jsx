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
        <li key={team.id} className="card p-5">
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
          {choosingTeam && <button type="button" className="btn btn-secondary mt-4 w-full" onClick={() => onSelectTeam(team.id)}>Select {team.name}</button>}
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
        </li>
      ))}
    </ul>
  );
}
