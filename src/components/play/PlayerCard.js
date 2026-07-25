export default function PlayerCard({
  player,
  disabled,
  onSelect,
}) {
  return (
    <button
      disabled={disabled}
      onClick={() => onSelect(player)}
      className={`w-full rounded-xl border border-neutral-700 p-4 text-left transition ${disabled ? 'opacity-50 cursor-not-allowed bg-neutral-800' : 'bg-neutral-900 hover:border-orange-500'}`}
    >
      <div className="flex justify-between">
        <span className="font-bold">
          {player.name}
        </span>

        <span>{player.rating}</span>
      </div>

      <div className="mt-1 text-sm text-neutral-500">
        {player.rol1}

        {player.rol2 &&
          ` / ${player.rol2}`}
      </div>
    </button>
  );
}
