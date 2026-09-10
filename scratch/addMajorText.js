const fs = require('fs');
let c = fs.readFileSync('src/components/CSMatchViewer.jsx', 'utf8');

c = c.replace(
  /<span style=\{\{ fontSize: 24, fontWeight: 700, color: "var\(--text-primary\)" \}\}>\{leftTeamName\}<\/span>/,
  `<div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                <span style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1 }}>{leftTeamName}</span>
                {leftTeamObj?.major && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 4 }}>{leftTeamObj.major}</span>
                )}
              </div>`
);

c = c.replace(
  /<span style=\{\{ fontSize: 24, fontWeight: 700, color: "var\(--text-primary\)" \}\}>\{rightTeamName\}<\/span>/,
  `<div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                <span style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1 }}>{rightTeamName}</span>
                {rightTeamObj?.major && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 4 }}>{rightTeamObj.major}</span>
                )}
              </div>`
);

fs.writeFileSync('src/components/CSMatchViewer.jsx', c);
