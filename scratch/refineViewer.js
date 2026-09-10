const fs = require('fs');

let viewer = fs.readFileSync('src/components/CSMatchViewer.jsx', 'utf8');

// 1. Larger team logos
viewer = viewer.replace(/width=\{36\} height=\{36\}/g, "width={56} height={56}");

// 2. Remove uppercase from team names in scoreboard
viewer = viewer.replace(/<span style=\{\{ fontSize: 24, fontWeight: 700, color: "var\(--text-primary\)", textTransform: "uppercase" \}\}>\{leftTeamName\}<\/span>/, 
  '<span style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)" }}>{leftTeamName}</span>');
viewer = viewer.replace(/<span style=\{\{ fontSize: 24, fontWeight: 700, color: "var\(--text-primary\)", textTransform: "uppercase" \}\}>\{rightTeamName\}<\/span>/, 
  '<span style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)" }}>{rightTeamName}</span>');

// 3. Remove uppercase from team names in match summary
viewer = viewer.replace(/<span style=\{\{ fontSize: 20, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: '0\.02em' \}\}>\{teamName\}<\/span>/, 
  '<span style={{ fontSize: 20, fontWeight: 800, color: "#fff", letterSpacing: "0.02em" }}>{teamName}</span>');

// 4. Center Strategy + Equip text over rosters
viewer = viewer.replace(/textAlign: "left", marginBottom: 12, paddingLeft: 4, fontSize: 13/, 
  'textAlign: "center", marginBottom: 12, fontSize: 13');
viewer = viewer.replace(/textAlign: "right", marginBottom: 12, paddingRight: 4, fontSize: 13/, 
  'textAlign: "center", marginBottom: 12, fontSize: 13');

// 5. Make match summary more compact
// Previously: <div style={{ marginTop: 20, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
viewer = viewer.replace(/<div style=\{\{ marginTop: 20, borderRadius: 12, overflow: 'hidden', border: '1px solid var\(--border\)' \}\}>/, 
  '<div style={{ maxWidth: 840, margin: "20px auto 0", borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)" }}>');

fs.writeFileSync('src/components/CSMatchViewer.jsx', viewer);
