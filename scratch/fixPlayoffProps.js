const fs = require('fs');
const files = ['src/app/simulation/page.js', 'src/app/room/[id]/simulation/SimulationUI.jsx'];

files.forEach(f => {
  let c = fs.readFileSync(f, 'utf8');

  // Fix PlayoffBracket signature
  c = c.replace(/function PlayoffBracket\(\{ matches \}\) \{/, 'function PlayoffBracket({ matches, onTeamClick }) {');

  // Fix BracketMatchCard usages inside PlayoffBracket
  c = c.replace(/<BracketMatchCard onTeamClick=\{setRosterModalTeam\}/g, '<BracketMatchCard onTeamClick={onTeamClick}');

  // Fix Final Match missing onTeamClick
  c = c.replace(/<BracketMatchCard\s+m=\{final \|\| null\}\s+\/>/, '<BracketMatchCard m={final || null} onTeamClick={onTeamClick} />');

  // Fix PlayoffBracket invocation in SimulationPage / SimulationUI
  c = c.replace(/<PlayoffBracket matches=\{matches\} \/>/g, '<PlayoffBracket matches={matches} onTeamClick={setRosterModalTeam} />');
  c = c.replace(/<PlayoffBracket matches=\{playoffMatches\} \/>/g, '<PlayoffBracket matches={playoffMatches} onTeamClick={setRosterModalTeam} />');

  fs.writeFileSync(f, c);
});
