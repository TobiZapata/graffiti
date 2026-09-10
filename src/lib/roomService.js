import { db } from "./firebase";
import { collection, doc, setDoc, getDoc, updateDoc } from "firebase/firestore";

function generateRoomCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function createRoom(hostUid, hostName) {
  const roomCode = generateRoomCode();
  const roomRef = doc(collection(db, "rooms"), roomCode);

  const initialRoomData = {
    id: roomCode,
    hostId: hostUid,
    status: "lobby", // lobby | drafting | playing
    players: [
      {
        uid: hostUid,
        name: hostName || "Player 1",
        isHost: true,
        squad: [],
        teamName: ""
      }
    ],
    createdAt: new Date().toISOString()
  };

  await setDoc(roomRef, initialRoomData);
  return roomCode;
}

export async function joinRoom(roomCode, uid, name) {
  const roomRef = doc(db, "rooms", roomCode.toUpperCase());
  const roomSnap = await getDoc(roomRef);

  if (!roomSnap.exists()) {
    throw new Error("Room not found");
  }

  const roomData = roomSnap.data();

  if (roomData.status !== "lobby") {
    throw new Error("Match has already started");
  }

  if (roomData.players.length >= 8) {
    throw new Error("Room is full");
  }

  const playerExists = roomData.players.find(p => p.uid === uid);
  if (!playerExists) {
    const newPlayers = [
      ...roomData.players,
      {
        uid,
        name: name || `Player ${roomData.players.length + 1}`,
        isHost: false,
        squad: [],
        teamName: ""
      }
    ];
    await updateDoc(roomRef, { players: newPlayers });
  }

  return roomCode.toUpperCase();
}

export async function submitDraft(roomCode, uid, squad, teamName, icon) {
  const roomRef = doc(db, "rooms", roomCode.toUpperCase());
  const roomSnap = await getDoc(roomRef);
  
  if (!roomSnap.exists()) throw new Error("Room not found");
  
  const roomData = roomSnap.data();
  const updatedPlayers = roomData.players.map(p => {
    if (p.uid === uid) {
      return { ...p, squad, teamName, icon, isReady: true };
    }
    return p;
  });

  await updateDoc(roomRef, {
    players: updatedPlayers
  });
}
