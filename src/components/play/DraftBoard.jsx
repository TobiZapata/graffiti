import { playerOverall, roleLabel } from "@/lib/majorDisplay.mjs";

// Three rolled rosters side by side; each player is one click away.
export default function DraftBoard({ teams, pickedNames, onPick }) {
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
              const picked = pickedNames.has(player.name.toLowerCase());
              const overall = playerOverall(player);
              return (
                <li key={player.id}>
                  <button type="button" disabled={picked} onClick={() => onPick(player, team)}
                    className="-mx-2 flex h-10 w-[calc(100%+16px)] items-center gap-3 rounded-lg px-2 text-left transition-colors hover:bg-raised disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent">
                    <span className="min-w-0 flex-1 truncate font-medium">{player.name}</span>
                    <span className="text-ink-3">{picked ? "In squad" : roleLabel(player.role)}</span>
                    <span className="tabular w-7 text-right text-ink-2" aria-label={overall === null ? undefined : `Overall ${overall}`}>{overall ?? "—"}</span>
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
