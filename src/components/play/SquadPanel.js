export default function SquadPanel({
  squad,
}) {
  const emptySlots = 5 - squad.length;

  return (
    <section className="w-80 rounded-xl border border-neutral-700 bg-neutral-900 p-6">
      <h2 className="mb-6 text-2xl font-bold">
        MY SQUAD
      </h2>

      <div className="space-y-3">
        {squad.map((slot, index) => (
          <div
            key={index}
            className="rounded-lg border border-neutral-700 bg-neutral-800 p-3"
          >
            <div className="font-semibold">
              {slot.player?.name}
            </div>

            <div className="text-sm text-neutral-400">
              {slot.assignedRole}
            </div>
          </div>
        ))}

        {Array.from({
          length: emptySlots,
        }).map((_, index) => (
          <div
            key={`empty-${index}`}
            className="rounded-lg border border-dashed border-neutral-700 p-3 text-neutral-500"
          >
            Empty
          </div>
        ))}
      </div>
    </section>
  );
}
