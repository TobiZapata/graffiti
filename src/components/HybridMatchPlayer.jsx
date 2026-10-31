"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { assembleMirageBO1 } from "@/lib/assembleMirageBO1.mjs";
import { prepareReplayTeam } from "@/lib/replayTeam.mjs";
import { readReplayJSON } from "@/lib/readReplayJSON.mjs";
import { retryReplayAssembly } from "@/lib/retryReplayAssembly.mjs";
import { replaySeriesResult } from "@/lib/replaySeries.mjs";
import { createMapSummary, recoverMatchSummaryMaps } from "@/lib/matchSummary.mjs";
import MatchSummary from "./MatchSummary";
import RoundBankViewer from "./RoundBankViewer";

async function assembleMap(bank, match, tournamentId, index, signal) {
  const teamA = prepareReplayTeam(match.teamA), teamB = prepareReplayTeam(match.teamB);
  const seed = `${tournamentId}:${match.id}-map${index}`;
  return retryReplayAssembly(assemblySeed => {
    if (signal.aborted) throw new DOMException("Match cancelled", "AbortError");
    return assembleMirageBO1(bank, teamA, teamB, seed, assemblySeed);
  }, seed);
}

export default function HybridMatchPlayer({ match, onFinish, backHref = "/simulation", tournamentId = "", initialProgress = null, onSaveProgress }) {
  const [history, setHistory] = useState(initialProgress?.history ?? []);
  const [loaded, setLoaded] = useState(null);
  const [error, setError] = useState(null);
  const [retry, setRetry] = useState(0);
  const [watchedMap, setWatchedMap] = useState(initialProgress?.watchedMap ?? -1);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [recovered, setRecovered] = useState(null);
  const [confirmed, setConfirmed] = useState(null);
  const [confirmSkip, setConfirmSkip] = useState(false);
  const bank = useRef(null), submitting = useRef(false);
  const playback = useRef(initialProgress?.playback ?? null);
  const index = history.length;
  const series = useMemo(() => replaySeriesResult(match, history), [match, history]);
  const data = loaded?.index === index ? loaded.data : null;
  const currentError = error?.index === index && error.retry === retry ? error.message : "";
  const watched = watchedMap === index;
  const finalized = match.completed ? match.result : confirmed || series.result;
  const needsStats = finalized?.maps?.some(map => !map.playerStats);
  const result = finalized && { ...finalized, maps: recovered?.source === finalized ? recovered.maps : finalized.maps };

  useEffect(() => {
    if (match.completed || series.done) return;
    let cancelled = false;
    const controller = new AbortController();
    async function generate() {
      try {
        bank.current ??= await readReplayJSON("/round-bank/economy-index.json", controller.signal);
        const result = await assembleMap(bank.current, match, tournamentId, index, controller.signal);
        if (!cancelled) setLoaded({ index, data: result });
      } catch (e) {
        if (!cancelled && e.name !== "AbortError") setError({ index, retry, message: e.message });
      }
    }
    generate();
    return () => { cancelled = true; controller.abort(); };
  }, [match, index, retry, tournamentId, series.done]);

  useEffect(() => {
    if (!needsStats) return;
    const controller = new AbortController();
    async function recover() {
      const cachedMaps = [...history];
      if (data) cachedMaps[index] = createMapSummary(match, data);
      const maps = await recoverMatchSummaryMaps(match, finalized.maps, async mapIndex => {
        bank.current ??= await readReplayJSON("/round-bank/economy-index.json", controller.signal);
        return assembleMap(bank.current, match, tournamentId, mapIndex, controller.signal);
      }, cachedMaps);
      if (!controller.signal.aborted) setRecovered({ source: finalized, maps });
    }
    recover().catch(e => {
      if (e.name !== "AbortError" && !controller.signal.aborted) setRecovered({ source: finalized, maps: finalized.maps });
    });
    return () => controller.abort();
  }, [match, finalized, needsStats, history, data, index, tournamentId]);

  const savePlayback = useCallback(position => {
    playback.current = position;
    onSaveProgress?.({ history, watchedMap, playback: position });
  }, [history, watchedMap, onSaveProgress]);

  function markWatched() {
    if (data && replaySeriesResult(match, [...history, { winnerId: data.winner === "A" ? match.teamA.id : match.teamB.id }]).done) {
      finishMap();
      return;
    }
    setWatchedMap(index);
    onSaveProgress?.({ history, watchedMap: index, playback: playback.current });
  }

  async function submitResult(outcome) {
    if (submitting.current) return;
    submitting.current = true;
    setSaving(true);
    setSaveError("");
    try { const accepted = await onFinish(outcome); setConfirmed(accepted || outcome); setSaved(true); }
    catch (e) { setSaveError(e.message || "The result could not be saved."); }
    finally { submitting.current = false; setSaving(false); }
  }

  function finishMap() {
    if (!data || submitting.current) return;
    setConfirmSkip(false);
    let map;
    try { map = createMapSummary(match, data); }
    catch (e) { setError({ index, retry, message: e.message }); return; }
    const next = [...history, map], outcome = replaySeriesResult(match, next);
    if (!outcome.done) {
      playback.current = null;
      setHistory(next); setWatchedMap(-1);
      onSaveProgress?.({ history: next, watchedMap: -1, playback: null });
      return;
    }
    setHistory(next);
    submitResult(outcome.result);
  }

  // Only read once the map has been watched, so the label never spoils the result.
  const lastMap = data && replaySeriesResult(match, [...history, { winnerId: data.winner === "A" ? match.teamA.id : match.teamB.id }]).done;

  if (result) return <MatchSummary match={match} result={result} backHref={backHref}
    loadingStats={needsStats && recovered?.source !== finalized}
    saving={saving || (!saved && !match.completed && !saveError)} error={match.completed ? "" : saveError} onRetry={() => submitResult(result)} />;

  return <div className="min-h-screen bg-bg text-ink">
    <header className="border-b border-rule">
      <div className="mx-auto flex min-h-14 max-w-[1480px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2 sm:px-6">
        <Link href={backHref} className="link">Back to the Major</Link>
        <p className="meta tabular">
          Mirage · BO{series.bestOf} · map {index + 1}
          {series.bestOf > 1 && <> · series {series.winsA}–{series.winsB}</>}
          {history.map((map, i) => <span key={i}> · map {i + 1} {map.scoreA}–{map.scoreB}</span>)}
        </p>
        <div className="ml-auto flex items-center gap-3">
          {data && (watched ? (
            <button type="button" className="btn btn-primary" disabled={saving} onClick={finishMap}>
              {saving ? "Saving result…" : lastMap ? "Finish match" : "Next map"}
            </button>
          ) : confirmSkip ? <>
            <span className="text-ink-2">Skip to the end of this map?</span>
            <button type="button" className="btn btn-primary" disabled={saving} onClick={finishMap}>{saving ? "Saving result…" : "Skip"}</button>
            <button type="button" className="btn btn-secondary" onClick={() => setConfirmSkip(false)}>Keep watching</button>
          </> : (
            <button type="button" className="btn btn-secondary" onClick={() => setConfirmSkip(true)}>Skip map</button>
          ))}
        </div>
      </div>
    </header>
    {currentError && <div role="alert" className="mx-auto max-w-[1480px] px-4 py-4 text-negative sm:px-6"><p>{currentError}</p>
      {!data && <button type="button" className="btn btn-secondary mt-3" onClick={() => setRetry(value => value + 1)}>Try again</button>}</div>}
    {!data && !currentError && <p role="status" className="mx-auto max-w-[1480px] px-4 py-6 text-ink-2 sm:px-6">Preparing Mirage…</p>}
    {data && <RoundBankViewer key={`${match.id}:${index}`} catalog={data.catalog} matchMode
      teamA={match.teamA} teamB={match.teamB} seriesState={{ ...series, mapsToWin: Math.ceil(series.bestOf / 2) }}
      initialPlayback={initialProgress?.history.length === index ? initialProgress.playback : null} onPlaybackChange={savePlayback}
      backHref={backHref} onComplete={markWatched} />}
  </div>;
}
