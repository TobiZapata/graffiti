import PlayerCard from "./PlayerCard";

export default function TeamDetails({
  team,
  squad,
  onSelectPlayer,
  onBack,
}) {
  return (
    <div>
      <div className="mb-8 text-center relative">
        {onBack && (
          <button 
            onClick={onBack}
            className="absolute left-0 top-0 mt-4 ml-4 text-neutral-400 hover:text-white transition-colors flex items-center gap-1"
          >
            ← Back
          </button>
        )}
        <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-xl bg-neutral-800 overflow-hidden">
          {team.icon ? (
            <img src={team.icon} alt={team.name} className="h-full w-full object-contain p-3" />
          ) : (
            <span className="text-sm text-neutral-500">LOGO</span>
          )}
        </div>

        <h2 className="text-3xl font-bold">
          {team.name}
        </h2>

        <p className="text-neutral-500">
          {team.major}
        </p>
      </div>

      <div className="space-y-3">
        {team.players.map((player) => {
          const isPicked = squad?.some(s => s.player.name.toLowerCase() === player.name.toLowerCase());
          return (
            <PlayerCard
              key={player.id}
              player={player}
              disabled={isPicked}
              onSelect={onSelectPlayer}
            />
          );
        })}
      </div>
    </div>
  );
}
