import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc } from "firebase/firestore";
import fs from "fs";
import path from "path";

const firebaseConfig = {
  apiKey: "AIzaSyDDEeA0avaEA_ctL70FiEBWHN7PhoV7YXg",
  authDomain: "graffity-major.firebaseapp.com",
  projectId: "graffity-major",
  storageBucket: "graffity-major.firebasestorage.app",
  messagingSenderId: "1002003356093",
  appId: "1:1002003356093:web:15536f141340d2f10f9ad4"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const uploadTeams = async () => {
  try {
    const dataPath = path.join(process.cwd(), "src/data/teams.json");
    const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
    
    console.log(`Uploading ${data.length} teams...`);
    const teamsCollection = collection(db, "teams");
    
    for (const team of data) {
      const docRef = doc(teamsCollection, String(team.id));
      await setDoc(docRef, team);
      console.log(`Uploaded team: ${team.name}`);
    }
    
    console.log("All teams uploaded successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Error uploading teams:", err);
    process.exit(1);
  }
};

uploadTeams();
