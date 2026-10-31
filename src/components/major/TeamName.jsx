import { teamEvent } from "@/lib/majorDisplay.mjs";

// A team's name with the Major its roster comes from, quieter, so equal names stay apart.
export default function TeamName({ team, className = "" }) {
  const event = teamEvent(team);
  return (
    <span className={`min-w-0 truncate ${className}`}>
      {team.name}
      {event && <span className="text-ink-3"> · {event}</span>}
    </span>
  );
}
