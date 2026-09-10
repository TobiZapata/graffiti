const fs = require('fs');
let content = fs.readFileSync('src/app/room/[id]/simulation/SimulationUI.jsx', 'utf8');

// Use a replacer function to avoid regex escaping hell
content = content.replace(
  /<span\s*key=\{\s*t\.id\s*\}\s*className="text-\[10px\] font-bold text-green-400 bg-green-950\/50 px-1\.5 py-0\.5 rounded"\s*>\s*\{\s*t\.name\s*\}\s*<\/span>/g,
  '<div key={t.id} className="w-6 h-6 rounded bg-neutral-900 border border-green-500 shrink-0 flex items-center justify-center overflow-hidden" title={`${t.name}${t.major ? ` - ${t.major}` : ""}\\n${t.players?.map(p => p.name).join(", ")}`}>{t.icon ? <img src={t.icon} alt={t.name} className="w-5 h-5 object-contain" /> : <span className="text-[8px] font-bold text-green-500 uppercase">{t.name.slice(0,2)}</span>}</div>'
);

content = content.replace(
  /<span\s*key=\{\s*t\.id\s*\}\s*className="text-\[10px\] font-bold text-red-400 bg-red-950\/50 px-1\.5 py-0\.5 rounded"\s*>\s*\{\s*t\.name\s*\}\s*<\/span>/g,
  '<div key={t.id} className="w-6 h-6 rounded bg-neutral-900 border border-red-500 shrink-0 flex items-center justify-center overflow-hidden grayscale opacity-80" title={`${t.name}${t.major ? ` - ${t.major}` : ""}\\n${t.players?.map(p => p.name).join(", ")}`}>{t.icon ? <img src={t.icon} alt={t.name} className="w-5 h-5 object-contain" /> : <span className="text-[8px] font-bold text-red-500 uppercase">{t.name.slice(0,2)}</span>}</div>'
);

content = content.replace(
  /className={`flex items-center justify-center w-10 h-10 bg-neutral-800 rounded-md transition-all shrink-0 \$\{isWinnerA \? "ring-2 ring-white" : m\.completed \? "opacity-40 grayscale" : ""\}`} title={`\$\{m\.teamA\.name\}\$\{m\.teamA\.major \? \` - \$\{m\.teamA\.major\}\` : ""\}`}/g,
  'className={`flex items-center justify-center w-10 h-10 bg-neutral-800 rounded-md transition-all shrink-0 ${isWinnerA ? "ring-2 ring-white" : m.completed ? "opacity-40 grayscale" : ""}`} title={`${m.teamA.name}${m.teamA.major ? ` - ${m.teamA.major}` : ""}\\n${m.teamA.players?.map(p => p.name).join(", ")}`}'
);

content = content.replace(
  /className={`flex items-center justify-center w-10 h-10 bg-neutral-800 rounded-md transition-all shrink-0 \$\{isWinnerB \? "ring-2 ring-white" : m\.completed \? "opacity-40 grayscale" : ""\}`} title={`\$\{m\.teamB\.name\}\$\{m\.teamB\.major \? \` - \$\{m\.teamB\.major\}\` : ""\}`}/g,
  'className={`flex items-center justify-center w-10 h-10 bg-neutral-800 rounded-md transition-all shrink-0 ${isWinnerB ? "ring-2 ring-white" : m.completed ? "opacity-40 grayscale" : ""}`} title={`${m.teamB.name}${m.teamB.major ? ` - ${m.teamB.major}` : ""}\\n${m.teamB.players?.map(p => p.name).join(", ")}`}'
);

content = content.replace(
  /<div className="flex gap-2 min-w-\[1200px\]">/g,
  '<div className="flex items-center gap-2 min-w-[1200px]">'
);

fs.writeFileSync('src/app/room/[id]/simulation/SimulationUI.jsx', content);
