import PlayerIdentity from "@/components/PlayerIdentity";
import { playerAttributes, teamLabel, ROLE_FIELDS } from "@/lib/majorDisplay.mjs";

export default function SquadPanel({ squad, roles = {}, onRemove }) {
  const open = Math.max(0, 5 - squad.length);
  return (
    <section className="card self-start p-5" aria-labelledby="squad-title">
      <div className="flex items-baseline justify-between">
        <h2 id="squad-title" className="text-[16px] font-medium">Your squad</h2>
        <span className="meta tabular">{squad.length} of 5</span>
      </div>
      {onRemove && squad.length > 0 && <p className="meta mt-2">Removing a player also removes later picks. Spent rerolls stay spent.</p>}
      <ol className="mt-4 grid gap-1">
        {squad.map((slot, index) => {
          const tags = Object.entries(ROLE_FIELDS).filter(([field]) => roles[field] === String(index)).map(([, label]) => label);
          return (
            <li key={slot.player.id ?? slot.player.name} className="flex min-h-16 items-center gap-3 rounded-lg bg-raised px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium"><PlayerIdentity player={slot.player} /></span>
                <span className="block text-[10px] tabular text-ink-2">{playerAttributes(slot.player)}</span>
                {slot.team && <span className="meta block truncate">{teamLabel(slot.team)}</span>}
              </span>
              {tags.length > 0 && <span className="text-[12px] text-ink-2">{tags.join(" · ")}</span>}
              {onRemove && (
                <button type="button" onClick={() => onRemove(index)} aria-label={`Remove ${slot.player.name}`}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-control hover:text-ink">
                  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                </button>
              )}
            </li>
          );
        })}
        {Array.from({ length: open }, (_, i) => (
          <li key={`open-${i}`} className="flex h-12 items-center rounded-lg px-3 text-ink-3 outline outline-1 -outline-offset-1 outline-rule-strong outline-dashed">
            Open slot
          </li>
        ))}
      </ol>
    </section>
  );
}
