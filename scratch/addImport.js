const fs = require('fs');
const files = ['src/app/simulation/page.js', 'src/app/room/[id]/simulation/SimulationUI.jsx'];
files.forEach(f => {
  let c = fs.readFileSync(f, 'utf8');
  if (!c.includes('import TeamRosterModal')) {
    c = c.replace(/import \{ useRouter \} from "next\/navigation";/g, 'import { useRouter } from "next/navigation";\nimport TeamRosterModal from "@/components/TeamRosterModal";\nimport { useState } from "react";');
    fs.writeFileSync(f, c);
  }
});
