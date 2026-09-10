const fs = require('fs');

// 1. Fix SimulationUI.jsx missing state
let simUI = fs.readFileSync('src/app/room/[id]/simulation/SimulationUI.jsx', 'utf8');
if (!simUI.includes('const [rosterModalTeam')) {
  simUI = simUI.replace(
    /export default function SimulationUI\(\) \{/,
    'export default function SimulationUI() {\n  const [rosterModalTeam, setRosterModalTeam] = useState(null);'
  );
  fs.writeFileSync('src/app/room/[id]/simulation/SimulationUI.jsx', simUI);
}

// 2. Fix CSMatchViewer.jsx missing team obj definition
let viewer = fs.readFileSync('src/components/CSMatchViewer.jsx', 'utf8');
if (!viewer.includes('const leftTeamObj')) {
  viewer = viewer.replace(
    /const rightTeamName = isTeam1T \? r\.ctTeam : r\.tTeam;/g,
    `const rightTeamName = isTeam1T ? r.ctTeam : r.tTeam;

  const leftTeamObj = (teamA && teamA.name === leftTeamName) ? teamA : (teamB && teamB.name === leftTeamName) ? teamB : null;
  const rightTeamObj = (teamA && teamA.name === rightTeamName) ? teamA : (teamB && teamB.name === rightTeamName) ? teamB : null;`
  );
  fs.writeFileSync('src/components/CSMatchViewer.jsx', viewer);
}
