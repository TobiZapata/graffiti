"use client";
import {
  useState,
  useEffect,
  useCallback,
} from "react";

const WEAPON_POWER = {
  KNIFE: 0,
  GLOCK: 10,
  USP: 12,
  P250: 18,
  DEAGLE: 35,
  DUALIES: 14,
  TEC9: 22,
  FIVESEVEN: 22,
  MAC10: 28,
  MP9: 30,
  GALIL: 52,
  FAMAS: 52,
  AK47: 68,
  M4A1S: 63,
  M4A4: 63,
  SSG08: 60,
  AWP: 82,
  HE: 0,
  MOLOTOV: 0,
  INCENDIARY: 0,
};
const UTILITY = new Set([
  "HE",
  "MOLOTOV",
  "INCENDIARY",
]);

const WEAPON_IMG = {
  AK47: "/weapons/ak47.svg",
  M4A1S: "/weapons/m4a1_silencer.svg",
  M4A4: "/weapons/m4a1.svg",
  AWP: "/weapons/awp.svg",
  GLOCK: "/weapons/glock.svg",
  USP: "/weapons/usp_silencer.svg",
  DEAGLE: "/weapons/deagle.svg",
  DUALIES: "/weapons/elite.svg",
  P250: "/weapons/p250.svg",
  TEC9: "/weapons/tec9.svg",
  FIVESEVEN: "/weapons/fiveseven.svg",
  MAC10: "/weapons/mac10.svg",
  MP9: "/weapons/mp9.svg",
  GALIL: "/weapons/galilar.svg",
  FAMAS: "/weapons/famas.svg",
  SSG08: "/weapons/ssg08.svg",
  HE: "/weapons/hegrenade.svg",
  MOLOTOV: "/weapons/inferno.svg",
  INCENDIARY: "/weapons/inferno.svg",
  KNIFE: "/weapons/knife_butterfly.svg",
};

const MODIFIER_IMG = {
  HEADSHOT:
    "/modifiers/icon_headshot.svg",
  NO_SCOPE: "/modifiers/noscope.svg",
  THROUGH_SMOKE:
    "/modifiers/smoke_kill.svg",
  WALLBANG: "/modifiers/penetrate.svg",
};

const Icon = ({
  src,
  alt,
  size = 18,
}) => (
  <img
    src={src}
    alt={alt}
    style={{
      height: size,
      objectFit: "contain",
      flexShrink: 0,
    }}
  />
);

const PlayerName = ({
  name,
  side,
  size = 12,
}) => (
  <span
    style={{
      fontSize: size,
      fontWeight: 600, // Un poco más grueso para que destaque con el nuevo tamaño
      color:
        side === "T" ? "#dfbf63" : (
          "#86a4d7"
        ),
    }}
  >
    {name}
  </span>
);

// ─── TIMELINE ───────────────────────────────────────────────────────────────
function MatchTimeline({ rounds, currentRoundIdx, isCurrentRoundFinished }) {
  if (!rounds || rounds.length === 0) return null;
  const team1Name = rounds[0].tTeam;
  const team2Name = rounds[0].ctTeam;

  const getIcon = (type) => {
    switch (type) {
      case "KILL": return "/modifiers/kill.svg";
      case "TIME": return "/modifiers/clock.svg";
      case "BOMB": return "/weapons/planted_c4.svg";
      case "DEFUSE": return "/weapons/defuser.svg";
      default: return null;
    }
  };

  let score1 = 0;
  let score2 = 0;
  for (let i = 0; i < rounds.length; i++) {
    const isRevealed = i < currentRoundIdx || (i === currentRoundIdx && isCurrentRoundFinished);
    if (isRevealed && rounds[i]) {
      if (rounds[i].winnerName === team1Name) score1++;
      else score2++;
    }
  }
  const nextRoundIndex = isCurrentRoundFinished ? currentRoundIdx + 1 : currentRoundIdx;
  const visibleRoundNum = nextRoundIndex + 1;
  const totalSlots = visibleRoundNum <= 24 ? 24 : Math.ceil((visibleRoundNum - 24) / 6) * 6 + 24;
  
  const timelineSlots = Array.from({ length: totalSlots }, (_, i) => rounds[i] || null);

  let targetScore = 13;
  if (Math.max(score1, score2) >= 12 && totalSlots > 24) {
      targetScore = 13 + Math.floor((Math.max(score1, score2) - 12) / 3) * 3 + 3; 
  }
  const roundsNeeded = targetScore - Math.max(score1, score2);
  const trophyIdx = roundsNeeded > 0 ? (isCurrentRoundFinished ? currentRoundIdx + 1 : currentRoundIdx) + roundsNeeded - 1 : -1;

  const MaskIcon = ({ src, color, size }) => (
    <div style={{
      width: size, height: size,
      backgroundColor: color,
      WebkitMaskImage: `url(${src})`,
      WebkitMaskSize: "contain",
      WebkitMaskRepeat: "no-repeat",
      WebkitMaskPosition: "center"
    }} />
  );

  const halves = [];
  let currentHalf = [];
  timelineSlots.forEach((rd, i) => {
    currentHalf.push(rd);
    if ((i + 1) === 12 || (i + 1) === 24 || ((i + 1) > 24 && (i + 1 - 24) % 3 === 0)) {
      halves.push(currentHalf);
      currentHalf = [];
    }
  });
  if (currentHalf.length > 0) halves.push(currentHalf);

  return (
    <div style={{ 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "center",
      marginBottom: 10, 
      marginTop: 10,
      padding: "10px 16px",
      position: "relative",
      overflowX: "auto",
      background: "var(--surface-1)",
      borderRadius: 12,
      border: "0.5px solid var(--border)"
    }}>
      {halves.map((half, hIdx) => {
        let halfStartIdx = 0;
        for (let k = 0; k < hIdx; k++) halfStartIdx += halves[k].length;

        return (
          <div key={hIdx} style={{ display: "flex", gap: 2, marginRight: hIdx < halves.length - 1 ? 12 : 0, position: "relative" }}>
            {/* Halftime vertical separator line */}
            {hIdx > 0 && (
              <div style={{ position: "absolute", left: -7, top: "25%", height: "50%", width: 1, background: "var(--border)" }} />
            )}
            
            {half.map((rd, localIdx) => {
              const i = halfStartIdx + localIdx;
              const isRevealed = i < currentRoundIdx || (i === currentRoundIdx && isCurrentRoundFinished);
              const isCurrent = i === currentRoundIdx && !isCurrentRoundFinished;
              const isWinnerT1 = rd && rd.winnerName === team1Name;
              
              let tickColor = "rgba(255, 255, 255, 0.25)";
              if (isCurrent) tickColor = "#ffffff";
              else if (isRevealed && rd) {
                tickColor = rd.winnerSide === "T" ? "#dfbf63" : "#86a4d7";
              }
              
              if (!isRevealed && !isCurrent) {
                if (trophyIdx !== -1 && i > trophyIdx) {
                  tickColor = "rgba(255, 255, 255, 0.05)";
                }
              }
              
              const showNumber = (i + 1) % 5 === 0;

              return (
                <div key={i} style={{
                  position: "relative",
                  width: 20,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  zIndex: 1,
                }}>
                  {/* Top Area (Team 1) */}
                  <div style={{ height: 26, width: "100%", position: "relative" }}>
                    {isRevealed && isWinnerT1 && rd && rd.winType && (
                      <>
                        <div style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: 16, background: `linear-gradient(to top, ${tickColor}A0, transparent)` }} />
                        <div style={{ position: "absolute", bottom: 6, left: "50%", transform: "translateX(-50%)" }}>
                          <MaskIcon src={getIcon(rd.winType)} color={tickColor} size={14} />
                        </div>
                      </>
                    )}
                  </div>

                  {/* The Horizontal Dash */}
                  <div style={{ 
                    position: "relative", 
                    height: 4, 
                    width: 18, 
                    background: tickColor, 
                    boxShadow: isCurrent ? "0 0 6px #ffffff" : "none",
                    borderRadius: 2
                  }}>
                    {/* Superimposed Round Number */}
                    {showNumber && (
                      <div style={{
                        position: "absolute",
                        top: "50%", left: "50%",
                        transform: "translate(-50%, -50%)",
                        fontSize: 10,
                        color: "#ffffff",
                        fontWeight: "bold",
                        fontFamily: "var(--font-mono)",
                        textShadow: "0px 0px 2px #000, 0px 0px 4px #000",
                        zIndex: 2
                      }}>
                        {i + 1}
                      </div>
                    )}
                  </div>

                  {/* Bottom Area (Team 2) */}
                  <div style={{ height: 26, width: "100%", position: "relative" }}>
                    {isRevealed && !isWinnerT1 && rd && rd.winType && (
                      <>
                        <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: 16, background: `linear-gradient(to bottom, ${tickColor}A0, transparent)` }} />
                        <div style={{ position: "absolute", top: 6, left: "50%", transform: "translateX(-50%)" }}>
                          <MaskIcon src={getIcon(rd.winType)} color={tickColor} size={14} />
                        </div>
                      </>
                    )}
                  </div>

                  {/* Trophy */}
                  {i === trophyIdx && (
                    <div style={{ 
                      position: "absolute", 
                      top: 32, 
                      left: "50%", 
                      transform: "translateX(-50%)", 
                      zIndex: 10,
                    }}>
                      <MaskIcon src="/modifiers/trophy.svg" color="#ffffff" size={14} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ─── PLAYER CARD ────────────────────────────────────────────────────────────
function PlayerCard({
  name,
  weapon,
  alive,
  side,
  kda,
  isRight
}) {
  const dotColor =
    alive ?
      side === "T" ?
        "var(--text-warning)"
      : "var(--text-accent)"
    : "var(--text-muted)";

  // Buscamos la imagen correspondiente al ID del arma
  const weaponSrc = WEAPON_IMG[weapon];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "5px 10px",
        borderRadius: "var(--radius)",
        border: `0.5px solid ${alive ? "var(--border-strong)" : "var(--border)"}`,
        background:
          alive ?
            "var(--surface-2)"
          : "var(--surface-0)",
        marginBottom: 4,
        opacity: alive ? 1 : 0.35,
        transition:
          "opacity 0.4s, background 0.4s, border-color 0.4s",
        flexDirection:
          isRight ?
            "row-reverse"
          : "row",
      }}
    >
      <div
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: dotColor,
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontSize: 13,
          fontWeight: 500,
          flex: 1,
          color:
            alive ?
              "var(--text-primary)"
            : "var(--text-muted)",
          textDecoration:
            alive ? "none" : (
              "line-through"
            ),
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          textAlign:
            isRight ? "right" : "left",
        }}
      >
        {name}
      </span>

      {kda && (
        <span style={{
          fontSize: 10,
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-mono)',
          flexShrink: 0,
          whiteSpace: 'nowrap',
        }}>
          {kda.k}/{kda.d}/{kda.a}
        </span>
      )}

      {/* Reemplazo del texto short(weapon) por el Icono */}
      {alive && weaponSrc ?
        <Icon
          src={weaponSrc}
          alt={weapon}
          size={24}
        />
      : <span
          style={{
            fontSize: 11,
            flexShrink: 0,
            color: "var(--text-muted)",
            fontFamily:
              "var(--font-mono)",
            minWidth: 22,
            textAlign: "center",
          }}
        >
          —
        </span>
      }
    </div>
  );
}

// ─── FEED ENTRY STYLE ────────────────────────────────────────────────────────
function feedStyle(ev) {
  let color = "var(--text-primary)";
  let weight = 400;
  if (ev.type === "PLANT") {
    color = "var(--text-warning)";
    weight = 500;
  }
  if (ev.type === "DEFUSE") {
    color = "var(--text-accent)";
    weight = 500;
  }
  if (ev.type === "SAVE") {
    color = "var(--text-secondary)";
  }
  if (ev.type === "TEXT") {
    weight = 500;
    if (ev.winnerSide) {
      // Colorear con el color del side ganador (CT azul / T dorado)
      color = ev.winnerSide === "T" ? "#dfbf63" : "#86a4d7";
      weight = 700;
    } else {
      color =
        ev.text?.includes("explosión") ?
          "var(--text-warning)"
        : "var(--text-accent)";
    }
  }
  return { color, fontWeight: weight };
}

// ─── KILL FEED ENTRY ───────────────────────────────────────────────────────
// ─── KILL FEED ENTRY REFACTORIZADO ──────────────────────────────────────────
function KillFeedEntry({
  ev,
  opacity,
}) {
  let content = null;
  const killerSide =
    ev.killerSide ?? "T";

  // 1. Caso: Plant / Defuse
  if (
    ev.type === "PLANT" ||
    ev.type === "DEFUSE"
  ) {
    const isPlant = ev.type === "PLANT";
    const iconSrc =
      isPlant ?
        "/weapons/c4.svg"
      : "/weapons/defuser.svg";
    const side = isPlant ? "T" : "CT";

    content = (
      <>
        <Icon
          src={iconSrc}
          alt={
            isPlant ? "C4" : "Defuse"
          }
          size={22}
        />
        <PlayerName
          name={ev.player?.name}
          side={side}
          size={14}
        />
      </>
    );
  }
  // 2. Caso: Muerte por C4
  else if (ev.type === "BOMB_KILL") {
    content = (
      <>
        <Icon src="/weapons/planted_c4.svg" alt="Explosión C4" size={24} />
        <PlayerName name={ev.victim?.name} side={ev.victimSide ?? "CT"} size={14} />
      </>
    );
  }
  // 3. Caso: Otros eventos de texto (Fin de ronda, etc.)
  else if (ev.type !== "KILL") {
    const { color, fontWeight } =
      feedStyle(ev);
    content = (
      <span
        style={{
          color,
          fontWeight,
          fontSize: 14,
        }}
      >
        {ev.text}
      </span>
    );
  }
  // 3. Caso: Kills standard
  else {
    const victimSide =
      killerSide === "T" ? "CT" : "T";
    const weaponSrc =
      WEAPON_IMG[ev.killer.weapon];
    const modImgs = (ev.modifiers ?? [])
      .map((m) => MODIFIER_IMG[m])
      .filter(Boolean);

    content = (
      <>
        {ev.killerBlind && (
          <Icon
            src="/modifiers/blind_kill.svg"
            alt="cegado"
            size={22}
          />
        )}

        <PlayerName
          name={ev.killer.name}
          side={killerSide}
          size={14}
        />

        {/* Asistente con el mismo color del bando del Killer */}
        {ev.assist && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 3,
            }}
          >
            <span
              style={{
                marginRight: 3,
                fontSize: 13,
                color:
                  killerSide === "T" ?
                    "#dfbf63"
                  : "#86a4d7",
              }}
            >
              +
            </span>
            {ev.assist.type ===
              "FLASH" && (
              <Icon
                src="/modifiers/flashbang_assist.svg"
                alt="flash"
                size={18}
              />
            )}
            <PlayerName
              name={ev.assist.name}
              side={killerSide}
              size={13}
            />
          </div>
        )}

        {ev.airborne && (
          <span className="-translate-y-3 translate-x-1.5 -ml-2">
            <Icon
              src="/modifiers/inairkill.svg"
              alt="volando"
              size={22}
            />
          </span>
        )}

        {weaponSrc ?
          <Icon
            src={weaponSrc}
            alt={ev.killer.weapon}
            size={24}
          />
        : <span
            style={{
              fontSize: 12,
              color:
                "var(--text-secondary)",
              fontFamily:
                "var(--font-mono)",
            }}
          >
            [{short(ev.killer.weapon)}]
          </span>
        }

        {modImgs.map((src, i) => (
          <Icon
            key={i}
            src={src}
            alt={ev.modifiers[i]}
            size={22}
          />
        ))}

        <PlayerName
          name={ev.victim.name}
          side={victimSide}
          size={14}
        />
      </>
    );
  }

  // Contenedor Global Único con el contorno rojo centrado
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "6px 14px",
        margin: "6px auto",
        opacity,
        border: "1.5px solid #ed1516", // Contorno rojo pedido
        borderRadius: "6px", // Bordes redondeados
        background:
          "rgba(0, 0, 0, 0.25)", // Fondo oscuro sutil para que el contorno luzca limpio
        width: "fit-content", // Ajusta el contorno exacto al tamaño del texto/iconos
        transition: "opacity 0.3s",
      }}
    >
      {content}
    </div>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function CSMatchViewer({ rounds, matchSummary, onSimulationComplete, teamA, teamB, seriesState }) {
  const [roundIdx, setRoundIdx] =
    useState(0);
  const [eventIdx, setEventIdx] =
    useState(-1);
  const [
    playerStates,
    setPlayerStates,
  ] = useState({});
  const [playerKDA, setPlayerKDA] = useState({});
  const [feed, setFeed] = useState([]);
  const [playing, setPlaying] =
    useState(false);
  const [scoreT, setScoreT] =
    useState(0);
  const [scoreCT, setScoreCT] =
    useState(0);

  const fmt = (n) =>
    n
      .toString()
      .replace(
        /\B(?=(\d{3})+(?!\d))/g,
        ".",
      );

  const r = rounds[roundIdx];

  const reset = useCallback(
    (ri) => {
      const rd = rounds[ri];
      const ps = {};
      rd.tPlayers.forEach((p) => {
        ps[p.uid] = {
          alive: true,
          weapon: p.weapon,
          side: "T",
        };
      });
      rd.ctPlayers.forEach((p) => {
        ps[p.uid] = {
          alive: true,
          weapon: p.weapon,
          side: "CT",
        };
      });
      setPlayerStates(ps);

      // Compute cumulative KDA from all KILL events in rounds 0..ri-1
      const pkda = {};
      // Initialize all players
      rd.tPlayers.forEach((p) => { pkda[p.uid] = {k:0, d:0, a:0}; });
      rd.ctPlayers.forEach((p) => { pkda[p.uid] = {k:0, d:0, a:0}; });
      // Scan all previous rounds
      for (let i = 0; i < ri; i++) {
        for (const ev of rounds[i].events) {
          if (ev.type === "KILL") {
            if (ev.killer?.uid) {
              if (!pkda[ev.killer.uid]) pkda[ev.killer.uid] = {k:0, d:0, a:0};
              pkda[ev.killer.uid].k += 1;
            }
            if (ev.victim?.uid) {
              if (!pkda[ev.victim.uid]) pkda[ev.victim.uid] = {k:0, d:0, a:0};
              pkda[ev.victim.uid].d += 1;
            }
            if (ev.assist?.uid) {
              if (!pkda[ev.assist.uid]) pkda[ev.assist.uid] = {k:0, d:0, a:0};
              pkda[ev.assist.uid].a += 1;
            }
          }
        }
      }
      setPlayerKDA(pkda);

      setFeed([]);
      setEventIdx(-1);
      setScoreT(
        ri > 0 ?
          rounds[ri - 1].scoreT
        : 0,
      );
      setScoreCT(
        ri > 0 ?
          rounds[ri - 1].scoreCT
        : 0,
      );
    },
    [rounds],
  );

  useEffect(() => {
    reset(roundIdx);
  }, [roundIdx, reset]);

  const applyEv = useCallback(
    (ev, rd) => {
      if (ev.type === "KILL") {
        // Enriquecemos el evento guardando el bando antes de actualizar estados
        const enrichedEv = {
          ...ev,
          killerSide:
            playerStates[
              ev.killer?.uid
            ]?.side ?? "T",
        };
        setFeed((prev) =>
          [enrichedEv, ...prev].slice(
            0,
            9,
          ),
        );

        setPlayerKDA((prev) => {
          const n = { ...prev };
          if (ev.killer?.uid) {
            n[ev.killer.uid] = { ...n[ev.killer.uid], k: (n[ev.killer.uid]?.k || 0) + 1 };
          }
          if (ev.victim?.uid) {
            n[ev.victim.uid] = { ...n[ev.victim.uid], d: (n[ev.victim.uid]?.d || 0) + 1 };
          }
          if (ev.assist?.uid) {
            n[ev.assist.uid] = { ...n[ev.assist.uid], a: (n[ev.assist.uid]?.a || 0) + 1 };
          }
          return n;
        });

        setPlayerStates((prev) => {
          const n = { ...prev };

          if (n[ev.victim?.uid])
            n[ev.victim.uid] = {
              ...n[ev.victim.uid],
              alive: false,
              weapon: "KNIFE",
            };

          if (
            n[ev.killer?.uid] &&
            ev.killer.weapon &&
            !UTILITY.has(
              ev.killer.weapon,
            )
          ) {
            const curPow =
              WEAPON_POWER[
                n[ev.killer.uid].weapon
              ] ?? 0;
            const newPow =
              WEAPON_POWER[
                ev.killer.weapon
              ] ?? 0;
            if (newPow >= curPow)
              n[ev.killer.uid] = {
                ...n[ev.killer.uid],
                weapon:
                  ev.killer.weapon,
              };
          }

          return n;
        });
      }

      if (ev.type === "BOMB_KILL") {
        setPlayerKDA((prev) => {
          const n = { ...prev };
          if (ev.victim?.uid) {
            n[ev.victim.uid] = { ...n[ev.victim.uid], d: (n[ev.victim.uid]?.d || 0) + 1 };
          }
          return n;
        });

        setPlayerStates((prev) => {
          const n = { ...prev };
          if (n[ev.victim?.uid]) {
            n[ev.victim.uid] = {
              ...n[ev.victim.uid],
              alive: false,
              weapon: "KNIFE",
            };
          }
          return n;
        });
      }

      if (ev.type === "WEAPON_PICKUP") {
        setPlayerStates((prev) => {
          const n = { ...prev };
          if (n[ev.player?.uid])
            n[ev.player.uid] = {
              ...n[ev.player.uid],
              weapon: ev.weapon,
            };
          return n;
        });
      }

      if (
        ev.type === "TEXT" &&
        ev.text &&
        (ev.text.includes("gana") ||
          ev.text.includes("tiempo") ||
          ev.text.includes("explosión"))
      ) {
        setScoreT(rd.scoreT);
        setScoreCT(rd.scoreCT);

        if (rd.finalPlayers) {
          setPlayerStates((prev) => {
            const n = { ...prev };
            rd.finalPlayers.forEach(
              (p) => {
                if (n[p.uid])
                  n[p.uid] = {
                    ...n[p.uid],
                    weapon: p.weapon,
                  };
              },
            );
            return n;
          });
        }
      }

      if (ev.type === "PLANT") {
        const audio = new Audio(
          "/sounds/c4_initiate.wav",
          { volume: 0.5 },
        );
        audio
          .play()
          .catch((e) =>
            console.error(e),
          );
      }

      // Los KILL ya se manejan arriba; evitamos duplicarlos en el feed
      if (
        (ev.type !== "KILL" &&
          ev.type !== "SAVE" &&
          ev.text !== null) ||
        ev.type === "BOMB_KILL"
      ) {
        setFeed((prev) =>
          [ev, ...prev].slice(0, 9),
        );
      }
    },
    [playerStates],
  );

  // Auto-play loop corregido (Auto-avance completo sin pausas)
  useEffect(() => {
    if (!playing) return;

    const next = eventIdx + 1;

    // 1. CASO: Llegamos al final de los eventos de la ronda actual
    if (next >= r.events.length) {
      const t = setTimeout(() => {
        // Validamos si hay una próxima ronda disponible
        const hasNextRound =
          (
            typeof rounds !==
            "undefined"
          ) ?
            roundIdx < rounds.length - 1
          : true;

        if (hasNextRound) {
          setRoundIdx(
            (prev) => prev + 1,
          ); // Avanza de ronda
          setEventIdx(-1); // ¡Truco! Al setear -1, el próximo render ejecutará el evento 0 solo
          setPlaying(true); // Forzamos que siga en true por si las dudas
        } else {
          setPlaying(false); // Si era la última ronda de la partida, se detiene
          if (onSimulationComplete) onSimulationComplete();
        }
      }, 2000); // 1 segundo de entretiempo entre rondas para ver el feed limpio antes de la otra

      return () => clearTimeout(t);
    }

    // 2. CASO: Bucle normal de eventos (reproduce el evento actual)
    const t = setTimeout(() => {
      setEventIdx(next);
      applyEv(r.events[next], r);
    }, 400); // Velocidad rápida y dinámica entre eventos (180ms)

    return () => clearTimeout(t);
  }, [
    playing,
    eventIdx,
    roundIdx,
    applyEv,
    r.events,
  ]);

  const step = () => {
    const next = eventIdx + 1;
    if (next >= r.events.length) return;
    setEventIdx(next);
    applyEv(r.events[next], r);
  };

  const finished = eventIdx >= r.events.length - 1;

  const team1Name = rounds[0].tTeam;
  const isTeam1T = r.tTeam === team1Name;

  const leftTeamName = isTeam1T ? r.tTeam : r.ctTeam;
  const rightTeamName = isTeam1T ? r.ctTeam : r.tTeam;

  const leftTeamObj = (teamA && teamA.name === leftTeamName) ? teamA : (teamB && teamB.name === leftTeamName) ? teamB : null;
  const rightTeamObj = (teamA && teamA.name === rightTeamName) ? teamA : (teamB && teamB.name === rightTeamName) ? teamB : null;

  const leftSide = isTeam1T ? "T" : "CT";
  const rightSide = isTeam1T ? "CT" : "T";

  const leftScore = isTeam1T ? scoreT : scoreCT;
  const rightScore = isTeam1T ? scoreCT : scoreT;

  const leftStrategy = isTeam1T ? r.strategyT : r.strategyCT;
  const rightStrategy = isTeam1T ? r.strategyCT : r.strategyT;

  const leftEquip = isTeam1T ? r.equipT : r.equipCT;
  const rightEquip = isTeam1T ? r.equipCT : r.equipT;

  const leftPlayers = isTeam1T ? r.tPlayers : r.ctPlayers;
  const rightPlayers = isTeam1T ? r.ctPlayers : r.tPlayers;

  const getSideLogo = (side) => side === "T" ? "/ui/t_logo.svg" : "/ui/ct_logo.svg";
  const getSideBg = (side) => side === "T" ? "var(--bg-warning)" : "var(--bg-accent)";
  const getSideColor = (side) => side === "T" ? "var(--text-warning)" : "var(--text-accent)";

  return (
    <div
      style={{
        padding: "1rem 0",
        fontFamily: "var(--font-sans)",
      }}
    >
      {/* ── Controls ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          marginBottom: 14,
          paddingBottom: 12,
          borderBottom:
            "0.5px solid var(--border)",
        }}
      >
        <button
          onClick={() =>
            setRoundIdx((i) =>
              Math.max(0, i - 1),
            )
          }
          disabled={roundIdx === 0}
          style={{ fontSize: 13 }}
        >
          ← Ronda
        </button>

        {!finished ?
          <button
            onClick={() =>
              setPlaying((p) => !p)
            }
            style={{
              fontSize: 13,
              minWidth: 80,
            }}
          >
            {playing ?
              "⏸ Pausa"
            : "▶ Play"}
          </button>
        : <button
            onClick={() =>
              reset(roundIdx)
            }
            style={{
              fontSize: 13,
              minWidth: 80,
            }}
          >
            ↺ Repetir
          </button>
        }

        <button
          onClick={step}
          disabled={playing || finished}
          style={{ fontSize: 13 }}
        >
          Evento →
        </button>

        <button
          onClick={() =>
            setRoundIdx((i) =>
              Math.min(
                rounds.length - 1,
                i + 1,
              ),
            )
          }
          disabled={
            roundIdx ===
            rounds.length - 1
          }
          style={{ fontSize: 13 }}
        >
          Ronda →
        </button>
      </div>

      {/* ── Scoreboard ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 24, alignItems: "center", marginBottom: 20 }}>
        {/* Left Team */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", paddingRight: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "6px 12px", borderRadius: 8, background: getSideBg(leftSide), color: getSideColor(leftSide) }}>
              <img src={getSideLogo(leftSide)} alt={leftSide} width={24} height={24} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                <span style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1 }}>{leftTeamName}</span>
                {leftTeamObj?.major && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 4 }}>{leftTeamObj.major}</span>
                )}
              </div>
            {leftTeamObj?.icon && <img src={leftTeamObj.icon} alt={leftTeamName} width={56} height={56} style={{ objectFit: 'contain' }} />}
          </div>
          
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
            {rightTeamObj?.icon && <img src={rightTeamObj.icon} alt={rightTeamName} width={56} height={56} style={{ objectFit: 'contain' }} />}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                <span style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1 }}>{rightTeamName}</span>
                {rightTeamObj?.major && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 4 }}>{rightTeamObj.major}</span>
                )}
              </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "6px 12px", borderRadius: 8, background: getSideBg(rightSide), color: getSideColor(rightSide) }}>
              <img src={getSideLogo(rightSide)} alt={rightSide} width={24} height={24} />
            </div>
          </div>
          
        </div>
      </div>

      <MatchTimeline rounds={rounds} currentRoundIdx={roundIdx} isCurrentRoundFinished={finished} />

      {/* ── Main 3-column layout ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "1fr 1.7fr 1fr",
          gap: 10,
        }}
      >
        {/* Left players */}
        <div>
          <div style={{ textAlign: "center", marginBottom: 12, fontSize: 13, color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>
             {leftStrategy} • ${fmt(leftEquip)}
          </div>
          {leftPlayers.map((p) => (
            <PlayerCard isRight={false}
              key={p.uid}
              name={p.name}
              side={leftSide}
              alive={
                playerStates[p.uid]
                  ?.alive ?? true
              }
              weapon={
                playerStates[p.uid]
                  ?.weapon ?? p.weapon
              }
              kda={playerKDA[p.uid]}
            />
          ))}
        </div>

        {/* Kill feed */}
        <div
          style={{
            background:
              "var(--surface-1)",
            borderRadius: 12,
            border:
              "0.5px solid var(--border)",
            padding: "10px 12px",
            minHeight: 220,
          }}
        >
          {feed.length === 0 ?
            <div
              style={{
                fontSize: 12,
                color:
                  "var(--text-muted)",
                textAlign: "center",
                paddingTop: 16,
              }}
            >
              Presioná ▶ para iniciar
            </div>
          : feed.map((ev, i) => (
              <KillFeedEntry
                key={i}
                ev={ev}
                opacity={Math.max(
                  0.08,
                  1 - i * 0.12,
                )}
              />
            ))
          }
        </div>

        {/* Right players */}
        <div>
          <div style={{ textAlign: "center", marginBottom: 12, fontSize: 13, color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>
             ${fmt(rightEquip)} • {rightStrategy}
          </div>
          {rightPlayers.map((p) => (
            <PlayerCard isRight={true}
              key={p.uid}
              name={p.name}
              side={rightSide}
              alive={
                playerStates[p.uid]
                  ?.alive ?? true
              }
              weapon={
                playerStates[p.uid]
                  ?.weapon ?? p.weapon
              }
              kda={playerKDA[p.uid]}
            />
          ))}
        </div>
      </div>



      {roundIdx === rounds.length - 1 && finished && matchSummary && (
        <div style={{ marginTop: 20, background: 'var(--surface-1)', padding: 16, borderRadius: 12 }}>
          <h3 style={{ marginBottom: 16, textAlign: 'center', fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Match Summary</h3>
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
              <div style={{ maxWidth: 840, margin: "20px auto 0", borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)" }}>
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
                          <span style={{ fontSize: 20, fontWeight: 800, color: "#fff", letterSpacing: "0.02em" }}>{teamName}</span>
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
        </div>
      )}
    </div>
  );
}
