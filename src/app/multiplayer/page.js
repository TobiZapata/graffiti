"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { createRoom, joinRoom } from "@/lib/roomService";
import Link from "next/link";

export default function MultiplayerPage() {
  const router = useRouter();
  const { user, loading, updateDisplayName } = useAuth();
  
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-white">Connecting to server...</div>;
  }

  const handleCreateRoom = async () => {
    if (!name.trim()) return setError("Please enter your name");
    setError("");
    setIsCreating(true);
    
    try {
      await updateDisplayName(name.trim());
      const newRoomCode = await createRoom(user.uid, name.trim());
      router.push(`/room/${newRoomCode}`);
    } catch (err) {
      console.error(err);
      setError("Failed to create room");
      setIsCreating(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!name.trim()) return setError("Please enter your name");
    if (!roomCode.trim() || roomCode.length !== 4) return setError("Please enter a valid 4-letter room code");
    
    setError("");
    setIsJoining(true);
    
    try {
      await updateDisplayName(name.trim());
      const joinedCode = await joinRoom(roomCode.trim(), user.uid, name.trim());
      router.push(`/room/${joinedCode}`);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to join room");
      setIsJoining(false);
    }
  };

  return (
    <main className="min-h-screen p-8 text-white flex flex-col items-center justify-center">
      <Link href="/" className="absolute top-8 left-8 text-neutral-400 hover:text-white flex items-center gap-2">
        ← Back
      </Link>

      <div className="w-full max-w-md bg-neutral-900/80 p-8 rounded-2xl border border-neutral-700 shadow-xl backdrop-blur-sm">
        <h1 className="text-3xl font-black text-center mb-8 text-amber-500">MULTIPLAYER LOBBY</h1>
        
        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-2 rounded mb-6 text-sm text-center">
            {error}
          </div>
        )}

        <div className="mb-8">
          <label className="block text-sm font-bold text-neutral-400 mb-2 uppercase">Your Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. s1mple"
            maxLength={15}
            className="w-full rounded-xl border border-neutral-700 bg-neutral-800 px-4 py-3 text-lg text-white placeholder-neutral-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Create Room */}
          <div className="flex flex-col gap-4">
            <button
              onClick={handleCreateRoom}
              disabled={isCreating || isJoining}
              className="h-full rounded-xl bg-amber-600 px-4 py-6 font-bold hover:bg-amber-500 disabled:opacity-50 transition-colors"
            >
              {isCreating ? "CREATING..." : "CREATE ROOM"}
            </button>
          </div>

          {/* Join Room */}
          <div className="flex flex-col gap-4 border-l border-neutral-700 pl-4">
            <input
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="CODE"
              maxLength={4}
              className="w-full rounded-xl border border-neutral-700 bg-neutral-800 px-4 py-3 text-center text-xl font-mono font-bold uppercase tracking-widest text-white placeholder-neutral-600 focus:border-amber-500 focus:outline-none"
            />
            <button
              onClick={handleJoinRoom}
              disabled={isCreating || isJoining}
              className="rounded-xl bg-neutral-700 px-4 py-3 font-bold hover:bg-neutral-600 disabled:opacity-50 transition-colors"
            >
              {isJoining ? "JOINING..." : "JOIN ROOM"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
