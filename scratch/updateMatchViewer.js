const fs = require('fs');
let content = fs.readFileSync('src/components/CSMatchViewer.jsx', 'utf8');

content = content.replace(
  /export default function CSMatchViewer\(\{\n  rounds,\n  matchSummary,\n  onSimulationComplete,\n\}\)/g,
  `export default function CSMatchViewer({
  rounds,
  matchSummary,
  onSimulationComplete,
  teamA,
  teamB
})`
);

content = content.replace(
  /const rightTeamName = isTeam1T \? r\.ctTeam : r\.tTeam;\n\n  const leftSide = isTeam1T \? "T" : "CT";/g,
  `const rightTeamName = isTeam1T ? r.ctTeam : r.tTeam;

  const leftTeamObj = (teamA && teamA.name === leftTeamName) ? teamA : (teamB && teamB.name === leftTeamName) ? teamB : null;
  const rightTeamObj = (teamA && teamA.name === rightTeamName) ? teamA : (teamB && teamB.name === rightTeamName) ? teamB : null;

  const leftSide = isTeam1T ? "T" : "CT";`
);

const oldScoreboard = `{/* ?????? Scoreboard ?????? */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        {/* Left Team */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "4px 8px", borderRadius: 6, background: getSideBg(leftSide), color: getSideColor(leftSide) }}>
              <img src={getSideLogo(leftSide)} alt={leftSide} width={20} height={20} />
            </div>
            <span style={{ fontSize: 15, fontWeight: 500, color: "var(--text-primary)" }}>{leftTeamName}</span>
          </div>
          <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            {leftStrategy} • \${fmt(leftEquip)}
          </span>
        </div>

        {/* Center Score */}
        <div style={{ textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontSize: 30, fontWeight: 500, color: "var(--text-primary)", minWidth: 36, textAlign: "right" }}>
              {leftScore}
            </span>
            <div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.06em", marginBottom: 2 }}>RONDA</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-secondary)" }}>{r.round} / 24</div>
            </div>
            <span style={{ fontSize: 30, fontWeight: 500, color: "var(--text-primary)", minWidth: 36, textAlign: "left" }}>
              {rightScore}
            </span>
          </div>
        </div>

        {/* Right Team */}
        <div style={{ textAlign: "right" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, justifyContent: "flex-end" }}>
            <span style={{ fontSize: 15, fontWeight: 500, color: "var(--text-primary)" }}>{rightTeamName}</span>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "4px 8px", borderRadius: 6, background: getSideBg(rightSide), color: getSideColor(rightSide) }}>
              <img src={getSideLogo(rightSide)} alt={rightSide} width={20} height={20} />
            </div>
          </div>
          <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            \${fmt(rightEquip)} • {rightStrategy}
          </span>
        </div>
      </div>`;

const newScoreboard = `{/* ?????? Scoreboard ?????? */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 20, alignItems: "center", marginBottom: 20 }}>
        {/* Left Team */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "4px 8px", borderRadius: 6, background: getSideBg(leftSide), color: getSideColor(leftSide) }}>
              <img src={getSideLogo(leftSide)} alt={leftSide} width={20} height={20} />
            </div>
            <span style={{ fontSize: 15, fontWeight: 500, color: "var(--text-primary)" }}>{leftTeamName}</span>
            {leftTeamObj?.icon && <img src={leftTeamObj.icon} alt={leftTeamName} width={24} height={24} style={{ objectFit: 'contain' }} />}
          </div>
          <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            {leftStrategy} • \${fmt(leftEquip)}
          </span>
        </div>

        {/* Center Score */}
        <div style={{ textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontSize: 30, fontWeight: 500, color: "var(--text-primary)", minWidth: 36, textAlign: "right" }}>
              {leftScore}
            </span>
            <div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.06em", marginBottom: 2 }}>RONDA</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-secondary)" }}>{r.round} / 24</div>
            </div>
            <span style={{ fontSize: 30, fontWeight: 500, color: "var(--text-primary)", minWidth: 36, textAlign: "left" }}>
              {rightScore}
            </span>
          </div>
        </div>

        {/* Right Team */}
        <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, justifyContent: "flex-end" }}>
            {rightTeamObj?.icon && <img src={rightTeamObj.icon} alt={rightTeamName} width={24} height={24} style={{ objectFit: 'contain' }} />}
            <span style={{ fontSize: 15, fontWeight: 500, color: "var(--text-primary)" }}>{rightTeamName}</span>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "4px 8px", borderRadius: 6, background: getSideBg(rightSide), color: getSideColor(rightSide) }}>
              <img src={getSideLogo(rightSide)} alt={rightSide} width={20} height={20} />
            </div>
          </div>
          <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            \${fmt(rightEquip)} • {rightStrategy}
          </span>
        </div>
      </div>`;

content = content.replace(oldScoreboard, newScoreboard);
fs.writeFileSync('src/components/CSMatchViewer.jsx', content);
