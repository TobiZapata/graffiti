import { db } from "./firebase";
import { collection, getDocs } from "firebase/firestore";

export async function getTeamsFromDB() {
  const querySnapshot = await getDocs(collection(db, "teams"));
  const teams = [];
  querySnapshot.forEach((doc) => {
    teams.push(doc.data());
  });
  return teams;
}
