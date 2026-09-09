"use client";

import { MultiplayerProvider } from "@/context/MultiplayerContext";
import SimulationUI from "./SimulationUI";
import { use } from "react";

export default function MultiplayerSimulationPage({ params }) {
  const roomId = use(params).id;
  
  return (
    <MultiplayerProvider roomId={roomId}>
      <SimulationUI />
    </MultiplayerProvider>
  );
}
