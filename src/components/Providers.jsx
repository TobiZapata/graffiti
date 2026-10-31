"use client";

import { TournamentProvider } from "@/context/TournamentContext";
import { AuthProvider } from "@/context/AuthContext";
import { RoomSessionProvider } from "@/context/RoomSessionContext";

export function Providers({ children }) {
  return (
    <AuthProvider>
      <RoomSessionProvider><TournamentProvider>{children}</TournamentProvider></RoomSessionProvider>
    </AuthProvider>
  );
}
