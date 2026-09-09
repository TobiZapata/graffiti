"use client";

import { TournamentProvider } from "@/context/TournamentContext";
import { AuthProvider } from "@/context/AuthContext";

export function Providers({ children }) {
  return (
    <AuthProvider>
      <TournamentProvider>{children}</TournamentProvider>
    </AuthProvider>
  );
}
