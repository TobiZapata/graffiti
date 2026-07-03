const ROLES = [
  "awper",
  "entry",
  "rifler",
  "support",
  "igl",
];

export default function RoleSelectionModal({
  player,
  onSelectRole,
  onClose,
}) {
  if (!player) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/70">
      <div className="w-96 rounded-xl bg-neutral-900 p-6">
        <h2 className="mb-2 text-2xl font-bold">
          {player.name}
        </h2>

        <p className="mb-6 text-neutral-400">
          Select a role
        </p>

        <div className="space-y-2">
          {ROLES.map((role) => (
            <button
              key={role}
              onClick={() =>
                onSelectRole(role)
              }
              className="w-full rounded-lg bg-neutral-800 p-3 text-left hover:bg-neutral-700"
            >
              {role}
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full rounded-lg bg-red-500 p-3"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
