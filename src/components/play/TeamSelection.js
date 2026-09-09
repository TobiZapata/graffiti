import TeamCard from "./TeamCard";

export default function TeamSelection({
  teams,
  onSelectTeam,
  onReroll,
  rerollsLeft
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="mb-2 px-2 text-center">
        <h2 className="text-2xl font-bold">Select a Team</h2>
      </div>
      {teams.map((team) => (
        <TeamCard
          key={team.id}
          team={team}
          onClick={() =>
            onSelectTeam(team)
          }
        />
      ))}
      {onReroll && (
        <div className="mt-4 flex justify-center">
          <button 
            onClick={onReroll}
            className="rounded-xl bg-amber-600 px-8 py-3 text-lg font-bold hover:bg-amber-700 transition-colors shadow-lg"
          >
            Reroll ({rerollsLeft} left)
          </button>
        </div>
      )}
    </div>
  );
}
