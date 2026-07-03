import { simulateMatch } from "@/app/engines/MatchEngine";
import { spiritPlayersConfig } from "@/data/spirit";
import { fazePlayersConfig } from "@/data/faze";
import CSMatchViewer from "@/components/CSMatchViewer";

export default function Home() {
  const { rounds } = simulateMatch(
    {
      name: "Spirit",
      players: spiritPlayersConfig,
    },
    {
      name: "FaZe",
      players: fazePlayersConfig,
    },
  );

  return (
    <main>
      <CSMatchViewer rounds={rounds} />
    </main>
  );
}
