"use client";

import { TournamentProvider } from "@/context/TournamentContext";

export function Providers({ children }) {
  return <TournamentProvider>{children}</TournamentProvider>;
}
