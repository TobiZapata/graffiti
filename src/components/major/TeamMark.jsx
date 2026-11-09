import { teamLabel } from "@/lib/majorDisplay.mjs";

// A team's logo as a button that opens its roster. Falls back to the first letters of its name.
export default function TeamMark({ team, size = 24, dim = false, onClick }) {
  const content = team.icon
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={team.icon} alt="" width={size} height={size} className="object-contain" style={{ width: size, height: size }} />
    : <span className="text-[11px] font-medium text-ink-2">{team.name.slice(0, 3)}</span>;
  const className = `flex shrink-0 items-center justify-center rounded-md transition-opacity ${dim ? "opacity-35" : ""}`;
  const box = { width: size + 8, height: size + 8 };
  if (!onClick) return <span className={className} style={box} title={teamLabel(team)}>{content}</span>;
  return (
    <button type="button" onClick={() => onClick(team)} className={`${className} cursor-pointer hover:bg-control`} style={box}
      title={teamLabel(team)} aria-label={`${teamLabel(team)} roster`}>
      {content}
    </button>
  );
}
