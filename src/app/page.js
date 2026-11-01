import teams from "@/data/teams.json";
import Home from "@/components/Home";

export default function Page() {
  const majors = [...new Set(teams.map(t => t.major))];
  const logos = [...new Map(teams.map(t => [t.icon, { icon: t.icon, name: t.name }])).values()].slice(0, 24);
  return <Home majors={majors} logos={logos} rosterCount={teams.length} />;
}
