const fs = require('fs');
const files = [
  'src/app/simulation/match/page.js',
  'src/app/room/[id]/match/page.js'
];
files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  content = content.replace(/\\`/g, '`');
  content = content.replace(/\\\$/g, '$');
  fs.writeFileSync(f, content);
});
