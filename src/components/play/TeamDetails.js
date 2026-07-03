import PlayerCard from "./PlayerCard";

export default function TeamDetails({
  team,
  onSelectPlayer,
}) {
  return (
    <div>
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-xl bg-neutral-800">
          LOGO
        </div>

        <h2 className="text-3xl font-bold">
          {team.name}
        </h2>

        <p className="text-neutral-500">
          {team.major}
        </p>
      </div>

      <div className="space-y-3">
        {team.players.map((player) => (
          <PlayerCard
            key={player.id}
            player={player}
            onSelect={onSelectPlayer}
          />
        ))}
      </div>
    </div>
  );
}
