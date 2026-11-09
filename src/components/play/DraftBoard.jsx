import PlayerIdentity from "@/components/PlayerIdentity";
import { playerAttributes } from "@/lib/majorDisplay.mjs";
import { sameDraftPlayer } from "@/lib/draftState.mjs";

// Three rolled rosters side by side; each player is one click away.
export default function DraftBoard({ teams, pickedPlayers, onPick }) {
  return (
    <ul className="grid gap-4 md:grid-cols-3">
      {teams.map(team => (
        <li key={team.id} className="card p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-raised p-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={team.icon} alt="" className="max-h-full max-w-full object-contain" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[16px] font-medium">{team.name}</span>
              <span className="meta block truncate">{team.major}</span>
            </span>
          </div>
          <ul className="mt-4" aria-label={`${team.name} roster`}>
            {team.players.map(player => {
              const picked = pickedPlayers.some(other => sameDraftPlayer(player, other));
              return (
                <li key={player.id}>
                  <button type="button" disabled={picked} onClick={() => onPick(player, team)}
                    className="-mx-2 flex min-h-16 w-[calc(100%+16px)] items-center gap-3 rounded-lg px-2 text-left transition-colors hover:bg-raised disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium"><PlayerIdentity player={player} /></span>
                      <span className="mt-1 block text-[11px] tabular text-ink-2">{playerAttributes(player)}</span>
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
