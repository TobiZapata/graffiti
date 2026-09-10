const fs = require('fs');

const fixPage = (filePath) => {
  let c = fs.readFileSync(filePath, 'utf8');

  // Change initial state to generate scheduledMaps
  const initStateRegex = /let hash = 0;\s*for \(let i = 0; i < currentMatch\.id\.length; i\+\+\) hash = currentMatch\.id\.charCodeAt\(i\) \+ \(\(hash << 5\) - hash\);\s*const initialMapIndex = Math\.abs\(hash\) % MAPS\.length;\s*setSeriesState\(\{[\s\S]*?\}\);/;
  
  const newInitState = `let hash = 0;
    for (let i = 0; i < currentMatch.id.length; i++) hash = currentMatch.id.charCodeAt(i) + ((hash << 5) - hash);
    let curHash = Math.abs(hash);
    let avail = MAPS.map((m, i) => i);
    let scheduledMaps = [];
    for(let i = 0; i < bestOf; i++) {
       let idx = curHash % avail.length;
       scheduledMaps.push(MAPS[avail[idx]]);
       avail.splice(idx, 1);
       curHash = (curHash * 31 + 17) % 1000000007;
    }

    setSeriesState({
      match: currentMatch,
      bestOf,
      winsA: 0,
      winsB: 0,
      mapsToWin: Math.ceil(bestOf / 2),
      scheduledMaps,
      mapHistory: [],
      currentMap: scheduledMaps[0]
    });`;
    
  c = c.replace(initStateRegex, newInitState);

  // Update handleFinishMatch
  const finishMatchRegex = /const \{ match, winsA, winsB, mapsToWin, bestOf, usedMaps \} = seriesState;\s*const \{ scoreTeam1, scoreTeam2 \} = matchData;[\s\S]*?setMatchData\(null\);\s*setSimulationDone\(false\);\s*\}/;
  
  const newFinishMatch = `const { match, winsA, winsB, mapsToWin, bestOf, scheduledMaps, mapHistory } = seriesState;
    const { scoreTeam1, scoreTeam2 } = matchData;
    
    const newWinsA = winsA + (scoreTeam1 > scoreTeam2 ? 1 : 0);
    const newWinsB = winsB + (scoreTeam1 < scoreTeam2 ? 1 : 0);
    
    const mapResult = {
       map: scheduledMaps[mapHistory.length],
       scoreA: scoreTeam1,
       scoreB: scoreTeam2,
       winnerId: scoreTeam1 > scoreTeam2 ? match.teamA.id : match.teamB.id,
    };
    
    if (newWinsA === mapsToWin || newWinsB === mapsToWin) {
      const winner = newWinsA > newWinsB ? match.teamA.id : match.teamB.id;
      const finalScoreA = bestOf === 1 ? scoreTeam1 : newWinsA;
      const finalScoreB = bestOf === 1 ? scoreTeam2 : newWinsB;

      completeMatch(match.id, {
        teamA: match.teamA,
        teamB: match.teamB,
        scoreA: finalScoreA,
        scoreB: finalScoreB,
        winner
      });
      router.push(filePath.includes('[id]') ? \`/room/\${roomId}/simulation\` : "/simulation");
    } else {
      setSeriesState({ 
        ...seriesState, 
        winsA: newWinsA, 
        winsB: newWinsB,
        mapHistory: [...mapHistory, mapResult],
        currentMap: scheduledMaps[mapHistory.length + 1]
      });
      setMatchData(null);
      setSimulationDone(false);
    }`;
  
  // Actually, wait, `filePath.includes('[id]')` won't work perfectly inside a string literal replaced at runtime. 
  // Let's use the router.push that was already there. 
  // We can just keep the router.push dynamically by capturing it, or matching the exact router push.
  // I will just use two different regexes for the else block.
  
  c = c.replace(/const availableMaps = MAPS\.map\(\(m, i\) => i\)\.filter\(i => !usedMaps\.includes\(i\)\);\s*const nextMapIndex = availableMaps\[Math\.floor\(Math\.random\(\) \* availableMaps\.length\)\];\s*setSeriesState\(\{[\s\S]*?currentMap: MAPS\[nextMapIndex\]\s*\}\);/,
  `setSeriesState({
        ...seriesState,
        winsA: newWinsA,
        winsB: newWinsB,
        mapHistory: [...mapHistory, mapResult],
        currentMap: scheduledMaps[mapHistory.length + 1]
      });`);
      
  c = c.replace(/const \{ match, winsA, winsB, mapsToWin, bestOf, usedMaps \} = seriesState;/, 
    'const { match, winsA, winsB, mapsToWin, bestOf, scheduledMaps, mapHistory } = seriesState;');
    
  c = c.replace(/const newWinsB = winsB \+ \(scoreTeam1 < scoreTeam2 \? 1 : 0\);/,
    `const newWinsB = winsB + (scoreTeam1 < scoreTeam2 ? 1 : 0);
    const mapResult = {
       map: scheduledMaps[mapHistory.length],
       scoreA: scoreTeam1,
       scoreB: scoreTeam2,
       winnerId: scoreTeam1 > scoreTeam2 ? match.teamA.id : match.teamB.id,
    };`);
    

  // Extract from return
  // Remove the old best of block:
  c = c.replace(/\{isSeries && \(\s*<div className="bg-neutral-900\/80[\s\S]*?<\/div>\s*\)\}/, '');
  
  // Add the Schedule UI
  const scheduleUI = `{isSeries && (
        <div className="absolute top-4 left-4 z-50 flex items-center bg-neutral-950/80 border border-neutral-800 rounded-lg px-3 py-2 backdrop-blur-md shadow-xl">
          {seriesState.scheduledMaps.map((mapInfo, index) => {
            const historyNode = seriesState.mapHistory[index];
            const isCurrent = index === seriesState.mapHistory.length;
            const isFuture = index > seriesState.mapHistory.length;
            
            return (
              <div key={index} className="flex items-center">
                {index > 0 && <span className="text-neutral-600 mx-2 text-[10px]">▶</span>}
                <div className={\`flex items-center gap-2 \${isFuture ? 'opacity-40' : ''}\`}>
                  {historyNode && historyNode.winnerId === match.teamA.id && match.teamA.icon && (
                    <img src={match.teamA.icon} alt="Winner" className="w-5 h-5 object-contain drop-shadow-md" />
                  )}
                  {historyNode && historyNode.winnerId === match.teamB.id && match.teamB.icon && (
                    <img src={match.teamB.icon} alt="Winner" className="w-5 h-5 object-contain drop-shadow-md" />
                  )}
                  <span className={\`font-bold text-sm tracking-wide \${isCurrent ? 'text-white drop-shadow-[0_0_4px_rgba(255,255,255,0.4)]' : 'text-neutral-400'}\`}>
                    {mapInfo.folder.toUpperCase()}
                  </span>
                  {historyNode && (
                    <span className="text-xs font-mono font-bold text-neutral-300 ml-1">
                      {historyNode.scoreA}:{historyNode.scoreB}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}`;
      
  c = c.replace(/<div className="absolute top-4 left-1\/2 -translate-x-1\/2 flex flex-col items-center z-50">/, scheduleUI + '\n      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center z-50">');
  
  // Pass seriesState to CSMatchViewer
  c = c.replace(/teamB=\{match\.teamB\}/, 'teamB={match.teamB}\n        seriesState={seriesState}');
  
  fs.writeFileSync(filePath, c);
};

fixPage('src/app/simulation/match/page.js');
fixPage('src/app/room/[id]/match/page.js');

// Fix CSMatchViewer.jsx
let viewer = fs.readFileSync('src/components/CSMatchViewer.jsx', 'utf8');

viewer = viewer.replace(/teamA,\n  teamB/, 'teamA,\n  teamB,\n  seriesState');

const oldScoreboardRegex = /\{\/\* ── Scoreboard ── \*\/\}[\s\S]*?(?=<MatchTimeline)/;

const newScoreboard = `{/* ── Scoreboard ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 24, alignItems: "center", marginBottom: 20 }}>
        {/* Left Team */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", paddingRight: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "6px 12px", borderRadius: 8, background: getSideBg(leftSide), color: getSideColor(leftSide) }}>
              <img src={getSideLogo(leftSide)} alt={leftSide} width={24} height={24} />
            </div>
            <span style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", textTransform: "uppercase" }}>{leftTeamName}</span>
            {leftTeamObj?.icon && <img src={leftTeamObj.icon} alt={leftTeamName} width={36} height={36} style={{ objectFit: 'contain' }} />}
          </div>
          <span style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            {leftStrategy} • \${fmt(leftEquip)}
          </span>
        </div>

        {/* Center Score */}
        <div style={{ textAlign: "center", display: "flex", alignItems: "center", gap: 20 }}>
          {/* Team A series score pips */}
          {seriesState && seriesState.bestOf > 1 && (
            <div style={{ display: "flex", gap: 4 }}>
              {Array.from({ length: seriesState.mapsToWin }).map((_, i) => (
                <div key={i} style={{ width: 6, height: 36, backgroundColor: i < seriesState.winsA ? "white" : "rgba(255,255,255,0.1)", borderRadius: 3, boxShadow: i < seriesState.winsA ? "0 0 8px rgba(255,255,255,0.5)" : "none" }} />
              ))}
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <span style={{ fontSize: 42, fontWeight: 700, color: "var(--text-primary)", minWidth: 46, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
              {leftScore}
            </span>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.1em", marginBottom: 2, textTransform: "uppercase" }}>Ronda</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>{r.round} / 24</div>
            </div>
            <span style={{ fontSize: 42, fontWeight: 700, color: "var(--text-primary)", minWidth: 46, textAlign: "left", fontVariantNumeric: "tabular-nums" }}>
              {rightScore}
            </span>
          </div>

          {/* Team B series score pips */}
          {seriesState && seriesState.bestOf > 1 && (
            <div style={{ display: "flex", gap: 4 }}>
              {Array.from({ length: seriesState.mapsToWin }).map((_, i) => (
                <div key={i} style={{ width: 6, height: 36, backgroundColor: i < seriesState.winsB ? "white" : "rgba(255,255,255,0.1)", borderRadius: 3, boxShadow: i < seriesState.winsB ? "0 0 8px rgba(255,255,255,0.5)" : "none" }} />
              ))}
            </div>
          )}
        </div>

        {/* Right Team */}
        <div style={{ textAlign: "left", display: "flex", flexDirection: "column", alignItems: "flex-start", paddingLeft: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
            {rightTeamObj?.icon && <img src={rightTeamObj.icon} alt={rightTeamName} width={36} height={36} style={{ objectFit: 'contain' }} />}
            <span style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", textTransform: "uppercase" }}>{rightTeamName}</span>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "6px 12px", borderRadius: 8, background: getSideBg(rightSide), color: getSideColor(rightSide) }}>
              <img src={getSideLogo(rightSide)} alt={rightSide} width={24} height={24} />
            </div>
          </div>
          <span style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            \${fmt(rightEquip)} • {rightStrategy}
          </span>
        </div>
      </div>\n\n      `;
      
viewer = viewer.replace(oldScoreboardRegex, newScoreboard);
fs.writeFileSync('src/components/CSMatchViewer.jsx', viewer);
