"use client";

import { TournamentProvider } from "@/context/TournamentContext";
import { AuthProvider } from "@/context/AuthContext";
import { RoomSessionProvider } from "@/context/RoomSessionContext";
import RoomChat from "@/components/RoomChat";

export function Providers({ children }) {
  return (
    <AuthProvider>
      <RoomSessionProvider><TournamentProvider>{children}</TournamentProvider><RoomChat /></RoomSessionProvider>
    </AuthProvider>
  );
}
