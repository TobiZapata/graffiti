const fs = require('fs');

function fixSeed(filePath) {
  let c = fs.readFileSync(filePath, 'utf8');
  c = c.replace(
    /const seed = \\-map\\;/,
    'const seed = seriesState.match.id + "-map" + seriesState.mapHistory.length;'
  );
  fs.writeFileSync(filePath, c);
}

fixSeed('src/app/simulation/match/page.js');
fixSeed('src/app/room/[id]/match/page.js');
