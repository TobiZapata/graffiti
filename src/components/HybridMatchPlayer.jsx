"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { assembleMirageBO1 } from "@/lib/assembleMirageBO1.mjs";
import { prepareReplayTeam } from "@/lib/replayTeam.mjs";
import { readReplayJSON } from "@/lib/readReplayJSON.mjs";
import { retryReplayAssembly } from "@/lib/retryReplayAssembly.mjs";
import { replaySeriesResult } from "@/lib/replaySeries.mjs";
import RoundBankViewer from "./RoundBankViewer";
import styles from "./RoundBankViewer.module.css";

export default function HybridMatchPlayer({ match, onFinish, backHref = "/simulation", tournamentId = "", initialProgress = null, onSaveProgress }) {
  const [history, setHistory] = useState(initialProgress?.history ?? []);
  const [loaded, setLoaded] = useState(null);
  const [error, setError] = useState(null);
  const [retry, setRetry] = useState(0);
  const [watchedMap, setWatchedMap] = useState(initialProgress?.watchedMap ?? -1);
  const [saving, setSaving] = useState(false);
  const bank = useRef(null), submitting = useRef(false);
  const playback = useRef(initialProgress?.playback ?? null);
  const index = history.length, series = replaySeriesResult(match, history);
  const data = loaded?.index === index ? loaded.data : null;
  const currentError = error?.index === index && error.retry === retry ? error.message : "";

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    async function generate() {
      try {
        bank.current ??= await readReplayJSON("/round-bank/economy-index.json", controller.signal);
        const teamA = prepareReplayTeam(match.teamA), teamB = prepareReplayTeam(match.teamB);
        const seed = `${tournamentId}:${match.id}-map${index}`;
        const result = await retryReplayAssembly(assemblySeed => {
          if (cancelled) throw new DOMException("Partida cancelada", "AbortError");
          return assembleMirageBO1(bank.current, teamA, teamB, seed, assemblySeed);
        }, seed);
        if (!cancelled) setLoaded({ index, data: result });
      } catch (e) {
        if (!cancelled && e.name !== "AbortError") setError({ index, retry, message: e.message });
      }
    }
    generate();
    return () => { cancelled = true; controller.abort(); };
  }, [match, index, retry, tournamentId]);

  const savePlayback = useCallback(position => {
    playback.current = position;
    onSaveProgress?.({ history, watchedMap, playback: position });
  }, [history, watchedMap, onSaveProgress]);

  function markWatched() {
    setWatchedMap(index);
    onSaveProgress?.({ history, watchedMap: index, playback: playback.current });
  }

  async function finishMap() {
    if (!data || submitting.current) return;
    const map = { map: "de_mirage", scoreA: data.scoreTeam1, scoreB: data.scoreTeam2,
      winnerId: data.winner === "A" ? match.teamA.id : match.teamB.id };
    const next = [...history, map], outcome = replaySeriesResult(match, next);
    if (!outcome.done) {
      playback.current = null;
      setHistory(next); setWatchedMap(-1);
      onSaveProgress?.({ history: next, watchedMap: -1, playback: null });
      return;
    }
    submitting.current = true;
    setSaving(true);
    try { await onFinish(outcome.result); }
    catch (e) { setError({ index, retry, message: e.message }); submitting.current = false; setSaving(false); }
  }

  return <div className="min-h-screen text-white" style={{ backgroundImage: "linear-gradient(rgba(0,0,0,.7), rgba(0,0,0,.8)), url('/maps/mirage/de_mirage_png.png')", backgroundSize: "cover", backgroundAttachment: "fixed" }}>
    <section className={`${styles.lab} ${styles.seriesHeader}`} aria-label="Serie de partidas">
      <header className={styles.header}><div className={styles.mapBadge}>
        <img src="/maps/mirage/map_icon_de_mirage.svg" alt="Mirage" width="48" height="48" />
        <div>
        <p>BO{series.bestOf} · Mirage · Mapa {index + 1}</p>
        {series.bestOf > 1 && <strong aria-label="Marcador de la serie">{series.winsA} – {series.winsB}</strong>}
        </div>
      </div><Link href={backHref}>Volver al torneo</Link></header>
      <p>{history.map((map, i) => <span key={i}>Mapa {i + 1}: Mirage {map.scoreA}–{map.scoreB} · </span>)}</p>
      {data && <div className={styles.controls}><button disabled={saving} onClick={finishMap}>
        {saving ? "Guardando resultado…" : watchedMap === index ? "Continuar" : "Omitir mapa"}
      </button></div>}
      {currentError && <div role="alert" className={styles.error}><p>{currentError}</p>
        {!data && <button onClick={() => setRetry(value => value + 1)}>Reintentar</button>}</div>}
      {!data && !currentError && <p role="status">Preparando Mirage…</p>}
    </section>
    {data && <RoundBankViewer key={`${match.id}:${index}`} catalog={data.catalog} matchMode
      teamA={match.teamA} teamB={match.teamB} seriesState={{...series, mapsToWin: Math.ceil(series.bestOf / 2)}}
      initialPlayback={initialProgress?.history.length === index ? initialProgress.playback : null} onPlaybackChange={savePlayback}
      backHref={backHref} onComplete={markWatched} />}
  </div>;
}
