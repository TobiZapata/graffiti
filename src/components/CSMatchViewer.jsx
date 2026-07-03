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
// ─── PLAYER CARD ────────────────────────────────────────────────────────────
function PlayerCard({
  name,
  weapon,
  alive,
  side,
}) {
  const isRight = side === "CT";
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
    color =
      ev.text?.includes("explosión") ?
        "var(--text-warning)"
      : "var(--text-accent)";
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
  // 2. Caso: Otros eventos de texto (Fin de ronda, etc.)
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
export default function CSMatchViewer({
  rounds,
}) {
  const [roundIdx, setRoundIdx] =
    useState(0);
  const [eventIdx, setEventIdx] =
    useState(-1);
  const [
    playerStates,
    setPlayerStates,
  ] = useState({});
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
        ps[p.name] = {
          alive: true,
          weapon: p.weapon,
          side: "T",
        };
      });
      rd.ctPlayers.forEach((p) => {
        ps[p.name] = {
          alive: true,
          weapon: p.weapon,
          side: "CT",
        };
      });
      setPlayerStates(ps);
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
              ev.killer?.name
            ]?.side ?? "T",
        };
        setFeed((prev) =>
          [enrichedEv, ...prev].slice(
            0,
            9,
          ),
        );

        setPlayerStates((prev) => {
          const n = { ...prev };

          if (n[ev.victim?.name])
            n[ev.victim.name] = {
              ...n[ev.victim.name],
              alive: false,
              weapon: "KNIFE",
            };

          if (
            n[ev.killer?.name] &&
            ev.killer.weapon &&
            !UTILITY.has(
              ev.killer.weapon,
            )
          ) {
            const curPow =
              WEAPON_POWER[
                n[ev.killer.name].weapon
              ] ?? 0;
            const newPow =
              WEAPON_POWER[
                ev.killer.weapon
              ] ?? 0;
            if (newPow >= curPow)
              n[ev.killer.name] = {
                ...n[ev.killer.name],
                weapon:
                  ev.killer.weapon,
              };
          }

          return n;
        });
      }

      if (ev.type === "WEAPON_PICKUP") {
        setPlayerStates((prev) => {
          const n = { ...prev };
          if (n[ev.player?.name])
            n[ev.player.name] = {
              ...n[ev.player.name],
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
                if (n[p.name])
                  n[p.name] = {
                    ...n[p.name],
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
        ev.type !== "KILL" &&
        ev.type !== "SAVE" &&
        ev.text !== null
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

  const finished =
    eventIdx >= r.events.length - 1;

  return (
    <div
      style={{
        padding: "1rem 0",
        fontFamily: "var(--font-sans)",
      }}
    >
      {/* ── Scoreboard ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent:
            "space-between",
          padding: "10px 16px",
          background:
            "var(--surface-1)",
          borderRadius: 12,
          border:
            "0.5px solid var(--border)",
          marginBottom: 10,
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 3,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                padding: "2px 6px",
                borderRadius: 4,
                background:
                  "var(--bg-warning)",
                color:
                  "var(--text-warning)",
              }}
            >
              T
            </span>
            <span
              style={{
                fontSize: 15,
                fontWeight: 500,
                color:
                  "var(--text-primary)",
              }}
            >
              {r.tTeam}
            </span>
          </div>
          <span
            style={{
              fontSize: 11,
              color:
                "var(--text-muted)",
              fontFamily:
                "var(--font-mono)",
            }}
          >
            {r.strategyT} · ${" "}
            {fmt(r.equipT)}
          </span>
        </div>

        <div
          style={{
            textAlign: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            <span
              style={{
                fontSize: 30,
                fontWeight: 500,
                color:
                  "var(--text-primary)",
                minWidth: 36,
                textAlign: "right",
              }}
            >
              {scoreT}
            </span>
            <div>
              <div
                style={{
                  fontSize: 10,
                  color:
                    "var(--text-muted)",
                  letterSpacing:
                    "0.06em",
                  marginBottom: 2,
                }}
              >
                RONDA
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color:
                    "var(--text-secondary)",
                }}
              >
                {r.round} / 24
              </div>
            </div>
            <span
              style={{
                fontSize: 30,
                fontWeight: 500,
                color:
                  "var(--text-primary)",
                minWidth: 36,
                textAlign: "left",
              }}
            >
              {scoreCT}
            </span>
          </div>
        </div>

        <div
          style={{ textAlign: "right" }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 3,
              justifyContent:
                "flex-end",
            }}
          >
            <span
              style={{
                fontSize: 15,
                fontWeight: 500,
                color:
                  "var(--text-primary)",
              }}
            >
              {r.ctTeam}
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                padding: "2px 6px",
                borderRadius: 4,
                background:
                  "var(--bg-accent)",
                color:
                  "var(--text-accent)",
              }}
            >
              CT
            </span>
          </div>
          <span
            style={{
              fontSize: 11,
              color:
                "var(--text-muted)",
              fontFamily:
                "var(--font-mono)",
            }}
          >
            ${fmt(r.equipCT)} ·{" "}
            {r.strategyCT}
          </span>
        </div>
      </div>

      {/* ── Main 3-column layout ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "1fr 1.7fr 1fr",
          gap: 10,
        }}
      >
        {/* T players */}
        <div>
          {r.tPlayers.map((p) => (
            <PlayerCard
              key={p.name}
              name={p.name}
              side="T"
              alive={
                playerStates[p.name]
                  ?.alive ?? true
              }
              weapon={
                playerStates[p.name]
                  ?.weapon ?? p.weapon
              }
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

        {/* CT players */}
        <div>
          {r.ctPlayers.map((p) => (
            <PlayerCard
              key={p.name}
              name={p.name}
              side="CT"
              alive={
                playerStates[p.name]
                  ?.alive ?? true
              }
              weapon={
                playerStates[p.name]
                  ?.weapon ?? p.weapon
              }
            />
          ))}
        </div>
      </div>

      {/* ── Controls ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          marginTop: 14,
          paddingTop: 12,
          borderTop:
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
    </div>
  );
}
