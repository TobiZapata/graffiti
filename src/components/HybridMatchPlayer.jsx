"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { simulationEngineVersion } from "@/lib/simulationVersion.mjs";
import { assembleMirageBO1 } from "@/lib/assembleMirageBO1.mjs";
import { prepareReplayTeam } from "@/lib/replayTeam.mjs";
import { readReplayJSON } from "@/lib/readReplayJSON.mjs";
import { retryReplayAssembly } from "@/lib/retryReplayAssembly.mjs";
import { replaySeriesResult } from "@/lib/replaySeries.mjs";
import { createMapSummary, recoverMatchSummaryMaps, hasMapMetrics } from "@/lib/matchSummary.mjs";
import { attachReplayMetrics } from "@/lib/replayMetrics.mjs";
import { selectHighlightRounds } from "@/lib/replayHighlights.mjs";
import { attachRoundResolutions } from "@/lib/replayResolution.mjs";
import { REPLAY_MAPS, selectReplayMap } from "@/lib/replayMaps.mjs";
import { createMapVeto, vetoStatus, applyMapVeto, stepNpcVeto } from "@/lib/mapVeto.mjs";
import MapVeto, { mapArtPath } from "./MapVeto";
import MatchSummary from "./MatchSummary";
import RoundBankViewer from "./RoundBankViewer";

async function assembleMap(bank, match, tournamentId, index, signal, simulation, metrics, map) {
  const engineVersion = simulationEngineVersion(simulation);
  if (map !== 'de_mirage' || simulation?.bankVersion === 'mirage-economy-v2') {
    bank = attachRoundResolutions(bank, await readReplayJSON(REPLAY_MAPS[map].resolution, signal));
  }
  const teamA = prepareReplayTeam(match.teamA), teamB = prepareReplayTeam(match.teamB);
  const seed = `${tournamentId}:${match.id}-map${index}`;
  const data = await retryReplayAssembly(assemblySeed => {
    if (signal.aborted) throw new DOMException("Match cancelled", "AbortError");
    return assembleMirageBO1(bank, teamA, teamB, seed, assemblySeed, engineVersion, map);
  }, seed);
  try { return attachReplayMetrics(data, await metrics(map)); }
  catch (error) {
    if (signal.aborted || error.name === "AbortError") throw error;
    // Missing display metrics must never prevent finishing or saving the match.
    return data;
  }
}

function MapLoading({ map, teamA, teamB }) {
  return (
    <main className="mx-auto max-w-[1480px] px-4 py-4 sm:px-6 sm:py-6">
      <div className="relative isolate flex min-h-[clamp(20rem,60vh,38rem)] flex-col justify-end overflow-hidden bg-surface px-5 py-6 sm:px-10 sm:py-9">
        <Image src={mapArtPath(map)} alt="" fill sizes="(max-width: 1480px) 100vw, 1432px"
          loading="eager" className="-z-20 object-cover" />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-linear-to-t from-black via-black/70 to-black/10" />
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">{REPLAY_MAPS[map].label}</h1>
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-base font-semibold sm:text-lg">
          {[["A", teamA], ["B", teamB]].map(([side, team]) => (
            <Fragment key={side}>
              <div className="flex min-w-0 items-center gap-2">
                {team.icon && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={team.icon} alt="" width={32} height={32} className="size-8 shrink-0 object-contain" />
                )}
                <span className="wrap-anywhere">{team.name}</span>
              </div>
              {side === "A" && <span className="text-ink-2">vs</span>}
            </Fragment>
          ))}
        </div>
        <p role="status" className="mt-7 flex items-center gap-2 text-sm text-ink-2">
          <span aria-hidden="true" className="size-4 rounded-full border-2 border-white/25 border-t-accent motion-safe:animate-spin" />
          Loading map…
        </p>
      </div>
    </main>
  );
}

export default function HybridMatchPlayer({ match, onFinish, backHref = "/simulation", tournamentId = "", initialProgress = null, onSaveProgress, playbackMode = "full", onPlaybackModeChange, playbackSpeed = 1, isMultiplayer = false, simulation = null, vetoPlayer = null, pvpVeto = null, allowShortcuts = true }) {
  const showControls = !isMultiplayer && process.env.NODE_ENV === "development";
  const vetoSeed = `${tournamentId}:${match.id}:veto`;
  const [localVeto, setVeto] = useState(() => initialProgress?.veto ?? (!pvpVeto && !initialProgress && !match.completed && vetoPlayer
    ? createMapVeto(replaySeriesResult(match, []).bestOf, vetoSeed, vetoPlayer) : null));
  const veto = pvpVeto ? pvpVeto.veto : localVeto;
  const [history, setHistory] = useState(initialProgress?.history ?? []);
  const [started, setStarted] = useState(initialProgress?.veto ? initialProgress.vetoStarted : !!initialProgress);
  const [legacyMap] = useState(() => initialProgress ? initialProgress.map ?? 'de_mirage' : match.completed ? match.result?.maps?.[0]?.map ?? 'de_mirage' : selectReplayMap(tournamentId, match.id));
  const map = veto ? vetoStatus(veto).maps[history.length] ?? legacyMap : legacyMap;
  const dust2BankVersion = veto ? 'v1.0.0' : initialProgress || match.completed ? initialProgress?.dust2BankVersion : 'v1.0.0';
  const nukeBankVersion = veto ? 'v1.0.0' : initialProgress || match.completed ? initialProgress?.nukeBankVersion : 'v1.0.0';
  const bankVersions = useMemo(() => ({ ...((veto || map === 'de_dust2') && dust2BankVersion ? { dust2BankVersion } : {}),
    ...((veto || map === 'de_nuke') && nukeBankVersion ? { nukeBankVersion } : {}) }), [map, dust2BankVersion, nukeBankVersion, veto]);
  const vetoProgress = useMemo(() => veto ? { veto, vetoStarted: started } : {}, [veto, started]);
  const bankUrl = useCallback(map => map === 'de_dust2' && !dust2BankVersion && !match.completed
    ? 'https://tobizapata.github.io/major-rounds-dust2/v0.0.0/economy-index.json'
    : REPLAY_MAPS[map].bank, [dust2BankVersion, match.completed]);
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
  const bank = useRef({}), metrics = useRef({}), submitting = useRef(false);
  const loadMetrics = useCallback(async map => {
    metrics.current[map] ??= await readReplayJSON(REPLAY_MAPS[map].metrics);
    return metrics.current[map];
  }, []);
  const playback = useRef(initialProgress?.playback ?? null);
  const index = history.length;
  const series = useMemo(() => replaySeriesResult(match, history), [match, history]);
  const data = loaded?.index === index ? loaded.data : null;
  const selectedRounds = useMemo(() => data && playbackMode === "highlights"
    ? selectHighlightRounds(data.catalog.rounds, `${tournamentId}:${match.id}-map${index}:highlights`)
    : null, [data, playbackMode, tournamentId, match.id, index]);
  const currentError = error?.index === index && error.retry === retry ? error.message : "";
  const watched = watchedMap === index;
  const finalized = match.completed ? match.result : confirmed || series.result;
  const needsStats = finalized?.maps?.some(map => !hasMapMetrics(map));
  const result = finalized && { ...finalized, maps: recovered?.source === finalized ? recovered.maps : finalized.maps };

  const saveVeto = useCallback(next => {
    onSaveProgress?.({ veto: next, vetoStarted: false, history, watchedMap, playback: null, ...bankVersions });
    setVeto(next);
  }, [onSaveProgress, history, watchedMap, bankVersions]);

  useEffect(() => {
    if (pvpVeto || !veto || started || !vetoPlayer) return;
    const status = vetoStatus(veto);
    if (status.done || status.turn === vetoPlayer) return;

    const lastAction = veto.actions[veto.actions.length - 1];
    const delayMs = lastAction && lastAction.team !== vetoPlayer ? 1400 : 1050;
    const timeout = setTimeout(() => saveVeto(stepNpcVeto(veto, vetoSeed, vetoPlayer)), delayMs);
    return () => clearTimeout(timeout);
  }, [pvpVeto, veto, started, vetoPlayer, vetoSeed, saveVeto]);

  useEffect(() => {
    if (!started || match.completed || series.done) return;
    let cancelled = false;
    const controller = new AbortController();
    async function generate() {
      try {
        bank.current[map] ??= await readReplayJSON(bankUrl(map), controller.signal);
        const result = await assembleMap(bank.current[map], match, tournamentId, index, controller.signal, simulation, loadMetrics, map);
        if (!cancelled) setLoaded({ index, data: result });
      } catch (e) {
        if (!cancelled && e.name !== "AbortError") setError({ index, retry, message: e.message });
      }
    }
    generate();
    return () => { cancelled = true; controller.abort(); };
  }, [match, index, retry, tournamentId, series.done, simulation, loadMetrics, map, started, bankUrl]);

  useEffect(() => {
    if (!needsStats) return;
    const controller = new AbortController();
    async function recover() {
      const cachedMaps = [...history];
      if (data) cachedMaps[index] = createMapSummary(match, data);
      const maps = await recoverMatchSummaryMaps(match, finalized.maps, async mapIndex => {
        const savedMap = finalized.maps[mapIndex].map;
        bank.current[savedMap] ??= await readReplayJSON(bankUrl(savedMap), controller.signal);
        return assembleMap(bank.current[savedMap], match, tournamentId, mapIndex, controller.signal, simulation, loadMetrics, savedMap);
      }, cachedMaps, true, match.completed && !dust2BankVersion ? async mapIndex => {
        if (finalized.maps[mapIndex].map !== 'de_dust2') return null;
        const legacyBank = await readReplayJSON('https://tobizapata.github.io/major-rounds-dust2/v0.0.0/economy-index.json', controller.signal);
        return assembleMap(legacyBank, match, tournamentId, mapIndex, controller.signal, simulation, loadMetrics, 'de_dust2');
      } : undefined);
      if (!controller.signal.aborted) setRecovered({ source: finalized, maps });
    }
    recover().catch(e => {
      if (e.name !== "AbortError" && !controller.signal.aborted) setRecovered({ source: finalized, maps: finalized.maps });
    });
    return () => controller.abort();
  }, [match, finalized, needsStats, history, data, index, tournamentId, simulation, loadMetrics, bankUrl, dust2BankVersion]);

  const savePlayback = useCallback(position => {
    playback.current = position;
    onSaveProgress?.({ map, history, watchedMap, playback: position, ...bankVersions, ...vetoProgress });
  }, [map, history, watchedMap, onSaveProgress, bankVersions, vetoProgress]);

  function markWatched() {
    if (data && replaySeriesResult(match, [...history, { winnerId: data.winner === "A" ? match.teamA.id : match.teamB.id }]).done) {
      finishMap();
      return;
    }
    setWatchedMap(index);
    onSaveProgress?.({ map, history, watchedMap: index, playback: playback.current, ...bankVersions, ...vetoProgress });
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
    let mapSummary;
    try { mapSummary = createMapSummary(match, data); }
    catch (e) { setError({ index, retry, message: e.message }); return; }
    const next = [...history, mapSummary], outcome = replaySeriesResult(match, next);
    if (!outcome.done) {
      playback.current = null;
      setHistory(next); setWatchedMap(-1);
      onSaveProgress?.({ map: veto ? vetoStatus(veto).maps[next.length] : map, history: next, watchedMap: -1, playback: null, ...bankVersions, ...vetoProgress });
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

  if (veto && !started) return <MapVeto veto={veto} match={match} playerTeam={vetoPlayer} backHref={backHref}
    isPvp={!!pvpVeto} turnDeadlineMs={pvpVeto?.turnDeadlineMs} busy={pvpVeto?.busy} error={pvpVeto?.error}
    opponentAbandoned={!!pvpVeto && !!match.result?.forfeit}
    onChoose={pvpVeto ? pvpVeto.onChoose : id => saveVeto(applyMapVeto(veto, id))} onStart={() => {
      if (!vetoStatus(veto).done) return;
      onSaveProgress?.({ map, history, watchedMap, playback: null, ...bankVersions, veto, vetoStarted: true });
      setStarted(true);
    }} />;

  return <div className="min-h-screen bg-bg text-ink">
    <header className="border-b border-rule">
      <div className="mx-auto flex min-h-14 max-w-[1480px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2 sm:px-6">
        <Link href={backHref} className="link">Back to the Major</Link>
        <p className="meta tabular">
          {REPLAY_MAPS[map].label} · BO{series.bestOf} · map {index + 1}{playbackMode === "highlights" && " · Highlights"}
          {series.bestOf > 1 && <> · series {series.winsA}–{series.winsB}</>}
          {history.map((map, i) => <span key={i}> · map {i + 1} {map.scoreA}–{map.scoreB}</span>)}
        </p>
        <div className="ml-auto flex items-center gap-3">
          {!isMultiplayer && onPlaybackModeChange && (!showControls || !watched) && <select aria-label="Playback mode"
            className="btn btn-secondary" value={playbackMode} onChange={event => onPlaybackModeChange(event.target.value)}>
            <option value="full">Full</option>
            <option value="highlights">Highlights</option>
          </select>}
          {showControls && data && (watched ? (
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
    {!started && <form className="mx-auto flex max-w-[1480px] items-center gap-4 px-4 py-6 sm:px-6" onSubmit={event => {
      event.preventDefault();
      onSaveProgress?.({ map, history, watchedMap, playback: null, ...bankVersions });
      setStarted(true);
    }}>
      <span>{series.bestOf > 1 ? 'Map for this series' : 'Map'}: {REPLAY_MAPS[map].label}</span>
      <button type="submit" className="btn btn-primary">Start match</button>
    </form>}
    {started && !data && !currentError && <MapLoading map={map} teamA={match.teamA} teamB={match.teamB} />}
    {data && <RoundBankViewer key={`${match.id}:${index}`} catalog={data.catalog} selectedRounds={selectedRounds} matchMode
      teamA={match.teamA} teamB={match.teamB} seriesState={{ ...series, mapsToWin: Math.ceil(series.bestOf / 2) }}
      initialSpeed={playbackSpeed} showControls={showControls} isMultiplayer={isMultiplayer}
      initialPlayback={initialProgress?.history.length === index ? initialProgress.playback : null} onPlaybackChange={savePlayback}
      backHref={backHref} onComplete={showControls ? markWatched : finishMap} allowShortcuts={allowShortcuts} />}
  </div>;
}
