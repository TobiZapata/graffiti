const fs = require('fs');

function processFile(filePath) {
  let c = fs.readFileSync(filePath, 'utf8');

  // Add import
  if (!c.includes('TeamRosterModal')) {
    c = c.replace(/import CSMatchViewer.*\n/, match => match + 'import TeamRosterModal from "@/components/TeamRosterModal";\n');
  }

  // Add state to SimulationPage / SimulationUI
  if (filePath.includes('SimulationUI.jsx')) {
    if (!c.includes('rosterModalTeam')) {
      c = c.replace(/const \[isNavigating, setIsNavigating\] = useState\(false\);/, match => match + '\n  const [rosterModalTeam, setRosterModalTeam] = useState(null);\n');
    }
  } else {
    if (!c.includes('rosterModalTeam')) {
      c = c.replace(/const router = useRouter\(\);/, match => match + '\n  const [rosterModalTeam, setRosterModalTeam] = useState(null);\n');
    }
  }

  // Advancing Teams
  c = c.replace(
    /className="w-6 h-6 rounded bg-neutral-900 border border-green-500 shrink-0 flex items-center justify-center overflow-hidden"/g,
    'className="w-6 h-6 rounded bg-neutral-900 border border-green-500 shrink-0 flex items-center justify-center overflow-hidden cursor-pointer hover:scale-110 transition-transform" onClick={() => typeof setRosterModalTeam !== "undefined" && setRosterModalTeam(t)}'
  );

  // Eliminated Teams
  c = c.replace(
    /className="w-6 h-6 rounded bg-neutral-900 border border-red-500 shrink-0 flex items-center justify-center overflow-hidden grayscale opacity-80"/g,
    'className="w-6 h-6 rounded bg-neutral-900 border border-red-500 shrink-0 flex items-center justify-center overflow-hidden grayscale opacity-80 cursor-pointer hover:scale-110 transition-transform" onClick={() => typeof setRosterModalTeam !== "undefined" && setRosterModalTeam(t)}'
  );

  // SwissMatchRow component
  c = c.replace(/function SwissMatchRow\(\{ m \}\) \{/g, 'function SwissMatchRow({ m, onTeamClick }) {');
  // Team A click
  c = c.replace(
    /className=\{\`flex items-center justify-center w-10 h-10 bg-neutral-800 rounded-md transition-all shrink-0 \$\{isWinnerA \? "ring-2 ring-white" : m\.completed \? "opacity-40 grayscale" : ""\}\`\}\s+title=\{\`\$\{m\.teamA\.name\}\$\{m\.teamA\.major \? \\\` - \\\$\{m\.teamA\.major\}\\\` : ""\}\\n\$\{m\.teamA\.players\?\.map\(p => p\.name\)\.join\([^)]*\)\}\`\}/g,
    'className={`flex items-center justify-center w-10 h-10 bg-neutral-800 rounded-md transition-all shrink-0 cursor-pointer hover:scale-110 ${isWinnerA ? "ring-2 ring-white" : m.completed ? "opacity-40 grayscale" : ""}`} title={`${m.teamA.name}${m.teamA.major ? ` - ${m.teamA.major}` : ""}\\n${m.teamA.players?.map(p => p.name).join(", ")}`} onClick={() => onTeamClick && onTeamClick(m.teamA)}'
  );
  // Team B click
  c = c.replace(
    /className=\{\`flex items-center justify-center w-10 h-10 bg-neutral-800 rounded-md transition-all shrink-0 \$\{isWinnerB \? "ring-2 ring-white" : m\.completed \? "opacity-40 grayscale" : ""\}\`\}\s+title=\{\`\$\{m\.teamB\.name\}\$\{m\.teamB\.major \? \\\` - \\\$\{m\.teamB\.major\}\\\` : ""\}\\n\$\{m\.teamB\.players\?\.map\(p => p\.name\)\.join\([^)]*\)\}\`\}/g,
    'className={`flex items-center justify-center w-10 h-10 bg-neutral-800 rounded-md transition-all shrink-0 cursor-pointer hover:scale-110 ${isWinnerB ? "ring-2 ring-white" : m.completed ? "opacity-40 grayscale" : ""}`} title={`${m.teamB.name}${m.teamB.major ? ` - ${m.teamB.major}` : ""}\\n${m.teamB.players?.map(p => p.name).join(", ")}`} onClick={() => onTeamClick && onTeamClick(m.teamB)}'
  );

  // BracketMatchCard component
  c = c.replace(/function BracketMatchCard\(\{ m \}\) \{/g, 'function BracketMatchCard({ m, onTeamClick }) {');
  c = c.replace(
    /className=\{\`flex items-center gap-2 p-2 \$\{isWinnerA \? "bg-neutral-800" : m\.completed \? "opacity-50" : ""\}\`\}/g,
    'className={`flex items-center gap-2 p-2 cursor-pointer hover:bg-neutral-700 transition-colors ${isWinnerA ? "bg-neutral-800" : m.completed ? "opacity-50" : ""}`} onClick={() => onTeamClick && onTeamClick(m.teamA)}'
  );
  c = c.replace(
    /className=\{\`flex items-center gap-2 p-2 \$\{isWinnerB \? "bg-neutral-800" : m\.completed \? "opacity-50" : ""\}\`\}/g,
    'className={`flex items-center gap-2 p-2 cursor-pointer hover:bg-neutral-700 transition-colors ${isWinnerB ? "bg-neutral-800" : m.completed ? "opacity-50" : ""}`} onClick={() => onTeamClick && onTeamClick(m.teamB)}'
  );

  // Add onTeamClick to instances
  c = c.replace(/<SwissMatchRow(\s+)key=\{/g, '<SwissMatchRow onTeamClick={setRosterModalTeam}$1key={');
  c = c.replace(/<BracketMatchCard\n\s+key=\{/g, '<BracketMatchCard onTeamClick={setRosterModalTeam}\n                                                key={');
  c = c.replace(/<BracketMatchCard key=\{/g, '<BracketMatchCard onTeamClick={setRosterModalTeam} key={');

  // Insert TeamRosterModal rendering at the bottom before closing div
  if (!c.includes('<TeamRosterModal team={rosterModalTeam}')) {
    // Both files end with something like `</div>\n  );\n}` for the main component. 
    // In `page.js`, it's `SimulationPage` ending with `<TeamSummary ... />`. 
    // Let's just insert it right after the TeamSummary modal.
    c = c.replace(/(\{\/\* MODALS \*\/\}[\s\S]*?)(\n\s*\{stage === "eliminated")/g, '$1\n        <TeamRosterModal team={rosterModalTeam} onClose={() => setRosterModalTeam(null)} />$2');
  }

  // Standings table hover and click
  c = c.replace(
    /className={`transition-colors \$\{t\.isPlayer \? "bg-amber-900\/20 text-amber-400" : "hover:bg-neutral-800\/50"\}`}/g,
    'className={`transition-colors cursor-pointer ${t.isPlayer ? "bg-amber-900/20 text-amber-400 hover:bg-amber-900/40" : "hover:bg-neutral-800"}`} onClick={() => setRosterModalTeam(t)}'
  );

  fs.writeFileSync(filePath, c);
}

processFile('src/app/simulation/page.js');
processFile('src/app/room/[id]/simulation/SimulationUI.jsx');
