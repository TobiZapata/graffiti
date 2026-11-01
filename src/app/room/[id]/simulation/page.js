"use client";

import { Suspense, use } from "react";
import { useSearchParams } from "next/navigation";
import { MultiplayerProvider } from "@/context/MultiplayerContext";
import SimulationUI from "./SimulationUI";

function MultiplayerSimulation({ params }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  return <MultiplayerProvider roomId={id} viewResults={searchParams.get("results") === "1"}><SimulationUI /></MultiplayerProvider>;
}

export default function MultiplayerSimulationPage({ params }) {
  return <Suspense fallback={<p className="p-6 text-ink-2">Loading Major…</p>}>
    <MultiplayerSimulation params={params} />
  </Suspense>;
}
