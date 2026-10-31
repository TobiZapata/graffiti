import { MultiplayerProvider } from "@/context/MultiplayerContext";
import SimulationUI from "./SimulationUI";

export default async function MultiplayerSimulationPage({ params, searchParams }) {
  const { id } = await params;
  const { results } = await searchParams;
  return <MultiplayerProvider roomId={id} viewResults={results === "1"}><SimulationUI /></MultiplayerProvider>;
}
