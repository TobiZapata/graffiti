const fs = require('fs');
let c = fs.readFileSync('src/components/CSMatchViewer.jsx', 'utf8');

// 1. Fix PlayerCard isRight prop
c = c.replace(
  /function PlayerCard\(\{\s*name,\s*weapon,\s*alive,\s*side,\s*kda,\s*\}\) \{/,
  'function PlayerCard({\n  name,\n  weapon,\n  alive,\n  side,\n  kda,\n  isRight\n}) {'
);
c = c.replace(/const isRight = side === "CT";\s*/g, '');

c = c.replace(/\{leftPlayers\.map\(\(p\) => \(\s*<PlayerCard/g, '{leftPlayers.map((p) => (\n            <PlayerCard isRight={false}');
c = c.replace(/\{rightPlayers\.map\(\(p\) => \(\s*<PlayerCard/g, '{rightPlayers.map((p) => (\n            <PlayerCard isRight={true}');

// 2. Move Equip/Strategy info
// Remove from Left Team
c = c.replace(/<span style=\{\{ fontSize: 13, color: "var\(--text-muted\)", fontFamily: "var\(--font-mono\)" \}\}>\s*\{leftStrategy\} • \$\{fmt\(leftEquip\)\}\s*<\/span>/, '');
// Remove from Right Team
c = c.replace(/<span style=\{\{ fontSize: 13, color: "var\(--text-muted\)", fontFamily: "var\(--font-mono\)" \}\}>\s*\$\{fmt\(rightEquip\)\} • \{rightStrategy\}\s*<\/span>/, '');

// Insert above leftPlayers
c = c.replace(/\{\/\* Left players \*\/\}\s*<div>/, 
`{/* Left players */}
        <div>
          <div style={{ textAlign: "left", marginBottom: 12, paddingLeft: 4, fontSize: 13, color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>
             {leftStrategy} • \${fmt(leftEquip)}
          </div>`);

// Insert above rightPlayers
c = c.replace(/\{\/\* Right players \*\/\}\s*<div>/,
`{/* Right players */}
        <div>
          <div style={{ textAlign: "right", marginBottom: 12, paddingRight: 4, fontSize: 13, color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>
             \${fmt(rightEquip)} • {rightStrategy}
          </div>`);


// 3. HLTV Match Summary Replacement
const oldSummaryRegex = /<h3 style=\{\{ marginBottom: 12, textAlign: 'center' \}\}>Match Summary<\/h3>[\s\S]*?\}\)\(\)\}\s*<\/div>/;

const newSummary = `<h3 style={{ marginBottom: 16, textAlign: 'center', fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Match Summary</h3>
          {(() => {
            const totalRounds = rounds.length;
            const enhancedStats = matchSummary.map(p => {
              const kpr = p.kills / totalRounds;
              const dpr = p.deaths / totalRounds;
              const apr = p.assists / totalRounds;
              let rating = (kpr * 0.75 + apr * 0.19 - dpr * 0.42 + 0.85);
              rating = Math.max(0.0, Math.min(2.0, rating));
              return { ...p, rating };
            }).sort((a, b) => b.rating - a.rating);

            // Ordenar los equipos para que el ganador o Team A este primero
            const teams = [...new Set(enhancedStats.map(p => p.team))].sort((a, b) => a === teamA?.name ? -1 : 1);
            
            return (
              <div style={{ marginTop: 20, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
                {teams.map((teamName, tIdx) => {
                  const teamPlayers = enhancedStats.filter(p => p.team === teamName);
                  const tObj = teamName === teamA?.name ? teamA : teamName === teamB?.name ? teamB : null;
                  
                  return (
                    <div key={teamName} style={{ borderBottom: tIdx === 0 ? '4px solid var(--bg-body)' : 'none' }}>
                      {/* Team Header */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#0a0a0a', padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                          {tObj?.icon ? (
                            <img src={tObj.icon} alt={teamName} width={32} height={32} style={{ objectFit: 'contain', filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.2))' }} />
                          ) : (
                             <div style={{ width: 32, height: 32, borderRadius: 6, backgroundColor: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 'bold', color: 'var(--text-muted)' }}>
                               {teamName.substring(0,3).toUpperCase()}
                             </div>
                          )}
                          <span style={{ fontSize: 20, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.02em' }}>{teamName}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 32, fontSize: 12, fontWeight: 800, color: '#888', textTransform: 'uppercase', minWidth: 320, paddingRight: 8 }}>
                          <div style={{ width: 60, textAlign: 'center' }}>K-D</div>
                          <div style={{ width: 50, textAlign: 'center' }}>+/-</div>
                          <div style={{ width: 50, textAlign: 'center' }}>A</div>
                          <div style={{ width: 60, textAlign: 'center' }}>Rating</div>
                        </div>
                      </div>
                      
                      {/* Players */}
                      <div style={{ backgroundColor: 'var(--surface-1)' }}>
                        {teamPlayers.map((p, pIdx) => {
                          const diff = p.kills - p.deaths;
                          const diffColor = diff > 0 ? '#4ade80' : diff < 0 ? '#f87171' : '#9ca3af';
                          
                          return (
                            <div key={p.uid} style={{ 
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                              padding: '10px 20px', 
                              backgroundColor: pIdx % 2 === 0 ? 'var(--surface-0)' : 'var(--surface-1)',
                              borderBottom: pIdx === teamPlayers.length - 1 ? 'none' : '1px solid var(--border-light)'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                 <div style={{ width: 32, height: 32, borderRadius: 6, backgroundColor: 'var(--bg-body)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                                   {p.role ? p.role.substring(0,3).toUpperCase() : "PLY"}
                                 </div>
                                 <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</span>
                              </div>
                              
                              <div style={{ display: 'flex', gap: 32, fontSize: 15, fontWeight: 500, color: 'var(--text-secondary)', minWidth: 320, paddingRight: 8 }}>
                                <div style={{ width: 60, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{p.kills}-{p.deaths}</div>
                                <div style={{ width: 50, textAlign: 'center', color: diffColor, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{diff > 0 ? '+' : ''}{diff}</div>
                                <div style={{ width: 50, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{p.assists}</div>
                                <div style={{ width: 60, textAlign: 'center', color: p.rating >= 1.05 ? '#4ade80' : p.rating <= 0.85 ? '#f87171' : 'var(--text-primary)', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{p.rating.toFixed(2)}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>`;

c = c.replace(oldSummaryRegex, newSummary);
fs.writeFileSync('src/components/CSMatchViewer.jsx', c);
