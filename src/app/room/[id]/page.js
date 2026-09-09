"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";

export default function RoomPage({ params }) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const roomId = use(params).id;

  const [room, setRoom] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/multiplayer");
      return;
    }

    const roomRef = doc(db, "rooms", roomId);
    const unsubscribe = onSnapshot(roomRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setRoom(data);

        // If the game has started, redirect to multiplayer draft
        if (data.status === "drafting") {
          router.push(`/room/${roomId}/draft`);
        }
      } else {
        setError("Room not found or was deleted.");
      }
    }, (err) => {
      console.error(err);
      setError("Failed to connect to room.");
    });

    return () => unsubscribe();
  }, [roomId, user, loading, router]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-white">
        <h2 className="text-2xl font-bold text-red-500 mb-4">{error}</h2>
        <Link href="/multiplayer" className="text-amber-500 underline">Back to Lobby</Link>
      </div>
    );
  }

  if (!room) {
    return <div className="min-h-screen flex items-center justify-center text-white">Loading room...</div>;
  }

  const isHost = room.hostId === user?.uid;
  const players = room.players || [];

  const handleStartDraft = async () => {
    try {
      const roomRef = doc(db, "rooms", roomId);
      await updateDoc(roomRef, { status: "drafting" });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <main className="min-h-screen p-8 text-white flex flex-col items-center">
      <div className="w-full max-w-2xl mt-12 bg-neutral-900/80 p-8 rounded-2xl border border-neutral-700 shadow-xl">
        <div className="flex items-center justify-between mb-8 pb-8 border-b border-neutral-800">
          <div>
            <h1 className="text-3xl font-black text-amber-500">LOBBY</h1>
            <p className="text-neutral-400 mt-2">Waiting for players to join...</p>
          </div>
          <div className="text-center">
            <span className="block text-sm font-bold text-neutral-500 mb-1">ROOM CODE</span>
            <span className="text-4xl font-mono font-black tracking-widest">{roomId}</span>
          </div>
        </div>

        <div className="mb-8">
          <div className="flex justify-between items-end mb-4">
            <h2 className="text-xl font-bold">Players</h2>
            <span className="text-sm font-bold text-neutral-500">{players.length} / 8</span>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            {players.map((p, idx) => (
              <div key={p.uid} className={`flex items-center gap-3 p-4 rounded-xl border ${p.uid === user?.uid ? 'border-amber-500 bg-amber-500/10' : 'border-neutral-700 bg-neutral-800'}`}>
                <div className="w-8 h-8 rounded-full bg-neutral-700 flex items-center justify-center font-bold text-sm">
                  {idx + 1}
                </div>
                <div className="flex flex-col">
                  <span className="font-bold">{p.name} {p.uid === user?.uid && "(You)"}</span>
                  {p.isHost && <span className="text-[10px] text-amber-500 uppercase tracking-wider font-bold">Host</span>}
                </div>
              </div>
            ))}
            
            {/* Empty slots */}
            {Array.from({ length: 8 - players.length }).map((_, idx) => (
              <div key={`empty-${idx}`} className="flex items-center gap-3 p-4 rounded-xl border border-dashed border-neutral-700 bg-neutral-800/30 opacity-50">
                <div className="w-8 h-8 rounded-full border border-neutral-600 flex items-center justify-center text-neutral-600">
                  +
                </div>
                <span className="text-neutral-500 font-bold italic">Waiting...</span>
              </div>
            ))}
          </div>
        </div>

        {isHost ? (
          <button
            onClick={handleStartDraft}
            className="w-full rounded-xl bg-green-600 px-6 py-4 text-xl font-black uppercase tracking-wider hover:bg-green-500 transition-colors shadow-lg shadow-green-600/20"
          >
            START MAJOR DRAFT
          </button>
        ) : (
          <div className="w-full rounded-xl bg-neutral-800 px-6 py-4 text-center text-lg font-bold text-neutral-400 uppercase tracking-wider border border-neutral-700">
            Waiting for host to start...
          </div>
        )}
      </div>
    </main>
  );
}
