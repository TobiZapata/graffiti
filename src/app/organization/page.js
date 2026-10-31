"use client";

import { Suspense, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTournament } from "@/context/TournamentContext";
import { organizationProfile } from "@/lib/organizationProfile.mjs";
import styles from "./page.module.css";

const outcomes = { active: "En curso", champion: "Campeón", finalist: "Finalista", semifinal: "Semifinales", quarterfinal: "Cuartos de final", swiss: "Eliminado en Swiss" };
const percentage = value => value === null ? "—" : `${Math.round(value)}%`;
const roleLabels = { mainAwperUid: "AWP", iglUid: "IGL", starUid: "STAR" };
const roleDragPrefix = "major-mvp-role:";

function RoomReturnLink() {
  const room = useSearchParams().get("room");
  return /^[A-Z0-9]{4}$/.test(room || "") ? <Link href={`/room/${room}`} className={styles.secondary}>Volver a la sala {room}</Link> : null;
}

export default function OrganizationPage() {
  const router = useRouter();
  const { organization, ready, storageError, startOrganizationMajor, assignOrganizationRole, standings, matches, matchProgress, stage, pendingResult, tournamentId } = useTournament();
  const [error, setError] = useState("");
  const [selectedRole, setSelectedRole] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [roleNotice, setRoleNotice] = useState("");
  const roleHelp = useRef(null);

  if (!ready) return <main className={styles.emptyPage}>Cargando organización…</main>;
  if (storageError && !organization) return <main className={styles.emptyPage} role="alert">{storageError}</main>;
  if (!organization) return <div className={styles.canvas}><main className={styles.emptyPage}>
    <span className={styles.eyebrow}>MAJOR MVP</span><h1>Tu historia empieza acá.</h1>
    <p>Creá una organización, elegí tus cinco jugadores y competí por tu primer Major.</p>
    <Link href="/play" className={styles.primary}>Crear organización</Link>
    <Link href="/" className={styles.back}>Volver al inicio</Link>
  </main></div>;

  const hasTournament = standings.length > 0;
  const finished = ["won", "eliminated"].includes(stage) || (stage === "results_pending" && ["won", "eliminated"].includes(pendingResult));
  const playerMatch = matches.find(match => match.isPlayerMatch && !match.completed);
  const continueHref = playerMatch && matchProgress?.[playerMatch.id] ? `/simulation/match?id=${encodeURIComponent(playerMatch.id)}` : "/simulation";
  const profile = organizationProfile(organization, { tournamentId, stage, pendingResult, matches, standings });
  const founded = new Date(organization.createdAt).getFullYear();

  function start() {
    try { startOrganizationMajor(); router.push("/simulation"); }
    catch (e) { setError(e.message || "No se pudo iniciar el Major. Intentá de nuevo."); }
  }

  function moveRole(field, uid) {
    if (!Object.hasOwn(roleLabels, field) || storageError) return;
    try {
      assignOrganizationRole(field, uid);
      setRoleNotice(`${roleLabels[field]} asignado a ${organization.squad[Number(uid)].player.name}.`);
      setError("");
    } catch (e) { setError(e.message); }
    setSelectedRole(null); setDropTarget(null);
  }

  return <div className={styles.canvas}><main className={styles.page}>
    <nav className={styles.navigation} aria-label="Organización">
      <Link href="/" className={styles.back}>← Inicio</Link>
      <div className={styles.actions}>
        <Suspense fallback={null}><RoomReturnLink /></Suspense>
        <Link href="/multiplayer" className={styles.secondary}>Salas</Link>
        {hasTournament && <Link href="/simulation" className={styles.secondary}>{finished ? "Ver últimos resultados" : "Ver cuadro"}</Link>}
        {!hasTournament || finished ? <button className={styles.primary} onClick={start}>Iniciar Major</button> : <Link className={styles.primary} href={continueHref}>Continuar Major</Link>}
      </div>
    </nav>
    {error && <p role="alert" className={styles.error}>{error}</p>}

    <section className={styles.profile} aria-label="Perfil de la organización">
      <header className={styles.identity}>
        <div className={styles.crest}><img src={organization.icon} alt={`Escudo de ${organization.name}`} width="100" height="100" /></div>
        <h1>{organization.name}</h1>
        <p>EST. {Number.isFinite(founded) ? founded : "—"} · PERFIL DE ORGANIZACIÓN</p>
        <span className={styles.active}>Organización activa</span>
        <div className={styles.colors} aria-label="Colores de la organización">{organization.colors.map((color, index) => <span key={index} title={color} style={{backgroundColor:color}} />)}</div>
      </header>

      <dl className={styles.metrics} aria-label="Estadísticas generales">
        <div><dd>{percentage(profile.winrate)}</dd><dt>Winrate general</dt></div>
        <div><dd>{profile.matchesPlayed}</dd><dt>Partidos</dt></div>
        <div><dd>{profile.majorsPlayed}</dd><dt>Majors jugados</dt></div>
      </dl>

      <div className={styles.results}>
        <section aria-labelledby="recent-results"><h2 id="recent-results">Resultados recientes</h2>
          {profile.recentMajors.length ? <ol className={styles.recent}>{profile.recentMajors.map((major, index) => <li key={major.id}>
            <span className={styles.resultMark} aria-hidden="true">{major.outcome === "champion" ? "🏆" : major.outcome === "finalist" ? "🥈" : major.outcome === "active" ? "●" : "–"}</span>
            <span>Major #{profile.majorsPlayed - index} <span className={styles.muted}>—</span> {outcomes[major.outcome]}</span>
          </li>)}</ol> : <p className={styles.empty}>Todavía no disputaste un Major.</p>}
        </section>
        <section aria-labelledby="historic-results"><h2 id="historic-results">Resultados históricos</h2>
          <div className={styles.honours}>
            <div><span className={styles.medal} aria-hidden="true">🏆</span><strong>×{profile.championships}</strong><small>Campeonatos</small></div>
            <div><span className={styles.medal} aria-hidden="true">🥈</span><strong>×{profile.finals}</strong><small>Finales alcanzadas</small></div>
          </div>
        </section>
      </div>
    </section>

    <div className={styles.rosters}>
      <section className={styles.panel} aria-labelledby="active-roster">
        <header className={styles.sectionHeading}><h2 id="active-roster">Plantilla activa</h2>
          <div className={styles.rosterTools}><span>5 jugadores</span><button type="button" className={styles.infoButton} aria-label="Información sobre roles" aria-haspopup="dialog" onClick={() => roleHelp.current.showModal()}>i</button></div>
        </header>
        <p className={styles.roleHint}>Arrastrá un rol a otro jugador, o tocá el rol y después su nombre.</p>
        <ul className={styles.roster}>{organization.squad.map((entry, index) => <li key={index}
          className={`${selectedRole ? styles.canAssign : ""} ${dropTarget === String(index) ? styles.dropTarget : ""}`}
          data-player-uid={String(index)}
          onDragOver={e => {
            if (storageError || !e.dataTransfer.types.includes("text/plain")) return;
            e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDropTarget(String(index));
          }}
          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDropTarget(null); }}
          onDrop={e => {
            e.preventDefault();
            const payload = e.dataTransfer.getData("text/plain");
            if (payload.startsWith(roleDragPrefix)) moveRole(payload.slice(roleDragPrefix.length), String(index));
            setDropTarget(null);
          }}>
          <span className={styles.playerNumber}>{String(index + 1).padStart(2, "0")}</span>
          <button type="button" className={styles.playerName} disabled={!selectedRole || !!storageError}
            aria-label={selectedRole ? `Asignar ${roleLabels[selectedRole]} a ${entry.player.name}` : entry.player.name}
            onClick={() => moveRole(selectedRole, String(index))}>{entry.player.name}</button>
          <span className={styles.roles}>
            {Object.entries(roleLabels).filter(([field]) => organization[field] === String(index)).map(([field, label]) =>
              <button type="button" key={field} data-role={field} draggable={!storageError} disabled={!!storageError}
                className={`${styles.roleBadge} ${field === "starUid" ? styles.star : ""}`}
                aria-label={`Mover ${label} de ${entry.player.name}`} aria-pressed={selectedRole === field}
                title={`Arrastrar ${label} o tocar para reasignar`}
                onClick={() => { setSelectedRole(selectedRole === field ? null : field); setRoleNotice(""); }}
                onDragStart={e => { e.dataTransfer.setData("text/plain", roleDragPrefix + field); e.dataTransfer.effectAllowed = "move"; setSelectedRole(field); }}
                onDragEnd={() => { setSelectedRole(null); setDropTarget(null); }}>
                {field === "starUid" ? "★ STAR" : label}
              </button>)}
          </span>
        </li>)}</ul>
        <div className={styles.roleStatus} role="status">
          {selectedRole ? <>Elegí quién va a ser {roleLabels[selectedRole]}. <button type="button" onClick={() => { setSelectedRole(null); setDropTarget(null); }}>Cancelar</button></> : roleNotice}
        </div>
        <p className={styles.roleHint}>Los cambios se aplican al próximo Major.</p>
        <dialog ref={roleHelp} className={styles.roleHelp} aria-labelledby="role-help-title" onClick={e => { if (e.target === e.currentTarget) roleHelp.current.close(); }}>
          <header><h2 id="role-help-title">Roles de tu plantilla</h2><button type="button" aria-label="Cerrar información de roles" onClick={() => roleHelp.current.close()}>×</button></header>
          <dl>
            <div><dt>AWP · Main AWPer</dt><dd>Tiene prioridad para comprar o recibir la AWP según la compra del equipo.</dd></div>
            <div><dt>IGL · Líder del equipo</dt><dd>Su lectura de juego influye en las posibilidades del equipo de ganar el partido.</dd></div>
            <div><dt>STAR · Jugador insignia</dt><dd>Representa a tu organización. Será el jugador protegido en la renovación de plantilla cuando ese sistema esté disponible.</dd></div>
          </dl>
          <p>Arrastrá el cartelito sobre otro jugador para mover el rol. También podés tocarlo o seleccionarlo con el teclado y después elegir el nombre de destino.</p>
          <p>AWP e IGL deben ser personas distintas: si movés uno sobre el otro, se intercambian. STAR puede coincidir con cualquiera.</p>
          <p className={styles.roleHint}>Podés cambiarlos desde acá. Se guardan para el próximo Major; el torneo en curso mantiene los roles con los que empezó.</p>
        </dialog>
      </section>
      <section className={styles.panel} aria-labelledby="former-players">
        <header className={styles.sectionHeading}><h2 id="former-players">Jugadores históricos</h2><span>Últimos 5</span></header>
        <div className={styles.formerEmpty}>
          <span className={styles.historyIcon} aria-hidden="true">↺</span>
          <h3>La historia recién empieza</h3>
          <p>Los jugadores que dejen la plantilla aparecerán acá con sus estadísticas en la organización.</p>
        </div>
      </section>
    </div>

    <section className={styles.panel} aria-labelledby="rivalries">
      <header className={styles.sectionHeading}><h2 id="rivalries">Rivalidades</h2><span>Rivales de Majors individuales · IA</span></header>
      {profile.rivals.length ? <div className={styles.tableScroll}><table className={styles.rivals}>
        <thead><tr><th scope="col">Organización</th><th scope="col">Partidos</th><th scope="col">Winrate</th></tr></thead>
        <tbody>{profile.rivals.map(rival => <tr key={rival.key}>
          <th scope="row">{rival.name}{rival.major && <small>{rival.major}</small>}</th><td>{rival.matches}</td><td>{percentage(rival.winrate)}</td>
        </tr>)}</tbody>
      </table></div> : <p className={styles.empty}>Tus enfrentamientos van a aparecer acá después del primer partido.</p>}
    </section>
    <footer className={styles.footer}>Guardado en este navegador · Tu organización se conserva entre Majors.</footer>
  </main></div>;
}
