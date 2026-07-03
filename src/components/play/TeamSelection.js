import TeamCard from "./TeamCard";

export default function TeamSelection({
  teams,
  onSelectTeam,
}) {
  return (
    <div className="flex flex-col gap-4">
      {teams.map((team) => (
        <TeamCard
          key={team.id}
          team={team}
          onClick={() =>
            onSelectTeam(team)
          }
        />
      ))}
    </div>
  );
}
