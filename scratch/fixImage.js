const fs = require('fs');
const files = ['src/app/room/[id]/simulation/SimulationUI.jsx', 'src/app/simulation/page.js'];
files.forEach(f => {
  let d = fs.readFileSync(f, 'utf8');
  d = d.replaceAll('<Image ', '<img ');
  d = d.replace(/import Image from ['"]next\/image['"];?/g, '');
  fs.writeFileSync(f, d);
});
