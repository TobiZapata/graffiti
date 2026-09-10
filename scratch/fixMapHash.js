const fs = require('fs');
const files = ['src/app/simulation/match/page.js', 'src/app/room/[id]/match/page.js'];

files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  content = content.replace(
    /const initialMapIndex = Math\.floor\(Math\.random\(\) \* MAPS\.length\);/g,
    `let hash = 0;
    for (let i = 0; i < currentMatch.id.length; i++) hash = currentMatch.id.charCodeAt(i) + ((hash << 5) - hash);
    const initialMapIndex = Math.abs(hash) % MAPS.length;`
  );
  fs.writeFileSync(f, content);
});
