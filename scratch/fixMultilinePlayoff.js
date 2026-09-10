const fs = require('fs');
const files = ['src/app/simulation/page.js', 'src/app/room/[id]/simulation/SimulationUI.jsx'];

files.forEach(f => {
  let c = fs.readFileSync(f, 'utf8');

  // Replace PlayoffBracket call, even if multiline
  c = c.replace(/<PlayoffBracket\s+matches=\{matches\}\s*\/>/g, '<PlayoffBracket matches={matches} onTeamClick={setRosterModalTeam} />');
  c = c.replace(/<PlayoffBracket\s+matches=\{playoffMatches\}\s*\/>/g, '<PlayoffBracket matches={playoffMatches} onTeamClick={setRosterModalTeam} />');

  fs.writeFileSync(f, c);
});
