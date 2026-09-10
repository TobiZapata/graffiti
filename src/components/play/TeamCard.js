export default function TeamCard({
  team,
  onClick,
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl border border-neutral-700 bg-neutral-900 p-6 text-left transition hover:border-orange-500"
    >
      <div className="mb-4 flex flex-col items-center">
        <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-lg bg-neutral-800 overflow-hidden">
          {team.icon ? (
            <img src={team.icon} alt={team.name} className="h-full w-full object-contain p-2" />
          ) : (
            <span className="text-xs text-neutral-500">LOGO</span>
          )}
        </div>

        <h2 className="text-xl font-bold">
          {team.name}
        </h2>

        <p className="text-sm text-neutral-500">
          {team.major}
        </p>
      </div>

      <div className="text-center text-xs text-neutral-500">
        {team.players
          .map((player) => player.name)
          .join(" • ")}
      </div>
    </button>
  );
}
