"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import Papa from "papaparse";
import { BroadcastState, CountUpdate, Story, coverageDuration, coverageFrames, createReplay, initialState, nextConstituencyCount, receiveUpdate } from "@/lib/broadcast/engine";
import styles from "./assembly.module.css";
import LowerThird from "./LowerThird";
import CountCoverage from "./CountCoverage";
import { outlineBroadcastText } from "./OutlinedText";
import FlowingBackdrop from "./FlowingBackdrop";
import BroadcastWindow, { openBroadcastWindow } from "./BroadcastWindow";
import { usePreResults } from "./PreResults";
import OverallCoverage from "./OverallCoverage";

type State = { data: BroadcastState; cursor: number; onAir: Story | null; coverage: Story | null; overview: boolean };
type Action = { type: "release"; update: CountUpdate } | { type: "complete"; updates: CountUpdate[] } | { type: "advance" } | { type: "reset" } | { type: "overview" };
const fresh = (): State => ({ data: initialState(), cursor: 0, onAir: null, coverage: null, overview: false });
function reducer(state: State, action: Action): State {
  if (action.type === "reset") return fresh();
  if (action.type === "complete") {
    const data = action.updates.reduce(receiveUpdate, initialState());
    return { data: { ...data, queue: [] }, cursor: action.updates.length, onAir: null, coverage: null, overview: true };
  }
  if (action.type === "overview") return { ...state, onAir: null, overview: true };
  if (action.type === "release") {
    const update = action.update;
    if (update.count !== (state.data.latest[update.constituency]?.count ?? 0) + 1) return state;
    const data = receiveUpdate(state.data, update);
    if (!state.onAir) {
      const [next, ...queue] = data.queue;
      return { ...state, cursor: data.seen.length, onAir: next, coverage: next, overview: false, data: { ...data, queue } };
    }
    return { ...state, cursor: data.seen.length, data };
  }
  // Keep a count and its election alerts together, then return to the overview.
  if (state.onAir) {
    const next = state.data.queue[0];
    if (next && next.update.id === state.onAir.update.id) {
      return { ...state, onAir: next, data: { ...state.data, queue: state.data.queue.slice(1) } };
    }
    return { ...state, onAir: null, overview: true };
  }
  const [next, ...queue] = state.data.queue;
  return { ...state, onAir: next ?? null, coverage: next ?? null, overview: false, data: { ...state.data, queue } };
}

export default function AssemblyBroadcast() {
  const [updates, setUpdates] = useState<CountUpdate[]>([]);
  const [error, setError] = useState("");
  const [state, dispatch] = useReducer(reducer, undefined, fresh);
  const [playing, setPlaying] = useState(false);
  const [selectedConstituency, setSelectedConstituency] = useState("");
  const [controls, setControls] = useState(true);
  const [previewAlert, setPreviewAlert] = useState(false);
  const [rollingPaused, setRollingPaused] = useState(false);
  const [overallSlide, setOverallSlide] = useState(0);
  const [overallPaused, setOverallPaused] = useState(false);
  const [fullscreenError, setFullscreenError] = useState("");
  const [outputWindow, setOutputWindow] = useState<Window | null>(null);
  const outputWindowRef = useRef<Window | null>(null);
  const [coverageProgress, setCoverageProgress] = useState({ id: "", index: 0 });
  const activeCount = state.onAir?.kind === "count" ? state.onAir : null;
  const frameIndex = coverageProgress.id === activeCount?.update.id ? coverageProgress.index : 0;
  useEffect(() => {
    if (!playing || !activeCount) return;
    const frames = coverageFrames(activeCount.update);
    if (frameIndex >= frames.length - 1) return;
    const timer = window.setTimeout(() => setCoverageProgress({ id: activeCount.update.id, index: frameIndex + 1 }), frames[frameIndex].duration);
    return () => window.clearTimeout(timer);
  }, [playing, activeCount, frameIndex]);
  useEffect(() => () => { outputWindowRef.current?.close(); }, []);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const hasQueuedStories = state.data.queue.length > 0;
  const awaitingStory = !state.onAir && !state.overview && hasQueuedStories;

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(([entry]) => {
      setScale(Math.min(entry.contentRect.width / 1920, entry.contentRect.height / 1080));
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/data/elections/northern-ireland/assembly/2022/election_data.csv", { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error("Could not load the 2022 results."); return response.text(); })
      .then(csv => {
        const parsed = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });
        if (parsed.errors.length) throw new Error("The results CSV could not be parsed.");
        const replay = createReplay(parsed.data);
        if (!replay.length) throw new Error("No counts were found in the results file.");
        setUpdates(replay);
      }).catch(reason => { if (reason.name !== "AbortError") setError(reason.message); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "h" && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLSelectElement)) setControls(value => !value);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  useEffect(() => {
    if (!playing || (!state.onAir && !state.overview && !hasQueuedStories)) return;
    const delay = state.onAir ? state.onAir.kind === "count" ? coverageDuration(state.onAir.update) + 100 : state.onAir.kind === "seat" ? 10000 : 8000 : state.overview ? 6000 : 500;
    const timer = window.setTimeout(() => dispatch({ type: "advance" }), delay);
    return () => window.clearTimeout(timer);
  }, [playing, state.onAir, state.overview, awaitingStory]);

  const constituencyOptions = [...new Set(updates.map(update => update.constituency))].sort((a, b) => a.localeCompare(b));
  const selectedName = selectedConstituency || constituencyOptions[0] || "";
  const nextUpdate = nextConstituencyCount(updates, state.data, selectedName);
  const first = Object.values(state.data.first);
  const preResults = usePreResults(updates, first.length > 0, rollingPaused);
  const story = state.onAir;
  const hasReportedResults = first.length > 0;
  const showingConstituency = story?.kind === "count";
  useEffect(() => {
    if (!hasReportedResults || showingConstituency || overallPaused) return;
    const timer = window.setInterval(() => setOverallSlide(value => (value + 1) % 4), 12000);
    return () => window.clearInterval(timer);
  }, [hasReportedResults, showingConstituency, overallPaused]);
  const replayFinished = updates.length > 0 && state.cursor === updates.length;
  const electionAlert = story && story.kind !== "count" ? story : undefined;
  const alertPreview: Story | undefined = previewAlert && updates[0] ? {
    id: "alert-preview", kind: "seat", update: updates[0],
    candidate: updates[0].candidates.find(candidate => candidate.status === "elected"),
  } : undefined;
  async function fullscreen() {
    try {
      if (outputWindow && !outputWindow.closed) {
        outputWindow.focus();
        if (outputWindow.document.fullscreenElement) await outputWindow.document.exitFullscreen();
        else await outputWindow.document.documentElement.requestFullscreen();
      }
      else if (document.fullscreenElement) await document.exitFullscreen();
      else await viewportRef.current?.requestFullscreen();
      setFullscreenError("");
    } catch { setFullscreenError("Fullscreen is unavailable in this browser. Use the browser fullscreen command."); }
  }

  const programme = outlineBroadcastText(<>
      <FlowingBackdrop />
      <header className={styles.header}>
        <div className={styles.headerTitle}>{story?.kind === "count" ? story.update.constituency : "OVERALL"}{story?.kind === "count" ? <strong>COUNT {story.update.count}</strong> : hasReportedResults && <strong className={styles.headerSection}>{["Vote share & changes", "Seats & changes", "Assembly at this hour", "Assembly at this hour · Designations"][overallSlide]}</strong>}</div>
        <div className={styles.replay}>2022 REPLAY<small>SIMULATED ARRIVAL TIMES</small></div>
      </header>

      <section className={`${styles.stage} ${story?.kind === "count" ? styles.coverageStage : ""}`} key={story?.kind === "count" ? story.update.id : "national"}>
        {error ? <div className={styles.empty}><h1>Results unavailable</h1><p role="alert">{error}</p></div> : !first.length ? <div className={styles.waitingOverview}>
          <div><p className={styles.eyebrow}>NORTHERN IRELAND · ASSEMBLY 2022</p><h1>Awaiting the<br />first results.</h1><p className={styles.waitingDeck}>18 constituencies. 90 seats.<br />The picture builds with every count.</p></div>
        </div> : !story || story.kind !== "count" ? <OverallCoverage data={state.data} baseline={preResults.baseline} slide={overallSlide} /> : <CountCoverage key={story.update.id} story={state.coverage ?? story} playing={playing} frameIndex={frameIndex} />}
      </section>
      <LowerThird data={state.data} preResults={preResults} rollingPaused={rollingPaused} alert={electionAlert ?? alertPreview} paused={!!electionAlert && !playing} />
  </>);

  return <main className={`${styles.shell} ${!controls ? styles.clean : ""}`}>
    <div className={styles.preview}>
      {controls && <div className={styles.previewToolbar}><div><strong>Programme preview</strong><span>1920 × 1080 · 16:9</span></div><span>{playing ? "REPLAY RUNNING" : "REPLAY PAUSED"}</span></div>}
      <div className={styles.viewport} ref={viewportRef}>
      <div className={styles.frame} style={{ width: 1920 * scale, height: 1080 * scale, visibility: scale ? "visible" : "hidden" }}>
    <div className={`${styles.output} ${!showingConstituency ? styles.lightOutput : ""}`} style={{ transform: `scale(${scale})` }}>
      {outputWindow ? <div className={styles.outputStandby}><strong>Broadcast output is open in its own window</strong><span>Use this desk to control results and playback.</span><button onClick={() => outputWindow.focus()}>Focus output window</button></div> : programme}
    </div>
      </div>
      </div>
      {controls && <p className={styles.previewHint}>The preview scales to fit. Broadcast graphics keep their 16:9 composition at every window size.</p>}
    </div>

    {controls && <section className={styles.controls} aria-label="Replay controls">
      <div><strong>Replay desk</strong><span>{state.cursor} / {updates.length} updates · {state.data.queue.length} queued stories</span></div>
      <button disabled={!updates.length || !!error} onClick={() => {
        setPlaying(false);
        setPreviewAlert(false);
        setOverallSlide(0);
        dispatch({ type: "complete", updates });
      }}>Complete mode — load final results</button>
      <button disabled={!updates.length || !!error} onClick={() => {
        setPlaying(value => !value);
      }}>{playing ? "Pause broadcast" : "Play broadcast"}</button>
      <label>Reporting constituency<select value={selectedName} disabled={!updates.length} onChange={event => setSelectedConstituency(event.target.value)}>{constituencyOptions.map(name => <option value={name} key={name}>{name}</option>)}</select></label>
      <p>{nextUpdate ? `Next report: count ${nextUpdate.count}` : updates.length ? "All counts for this constituency have reported." : "Loading counts…"}</p>
      <button disabled={!nextUpdate} onClick={() => { if (nextUpdate) { dispatch({ type: "release", update: nextUpdate }); setPlaying(true); } }}>Release {nextUpdate ? `count ${nextUpdate.count}` : "next count"}</button>
      <button onClick={() => dispatch({ type: "advance" })}>Next graphic</button>
      <button onClick={() => dispatch({ type: "overview" })}>National overview</button>
      <button onClick={() => { setPlaying(false); setOverallSlide(0); setCoverageProgress({ id: "", index: 0 }); dispatch({ type: "reset" }); }}>Reset</button>
      <button onClick={fullscreen}>Fullscreen output</button>
      <button onClick={() => {
        if (outputWindow && !outputWindow.closed) { outputWindow.focus(); return; }
        const popup = openBroadcastWindow();
        if (!popup) { setFullscreenError("The browser blocked the output window. Allow pop-ups for this site and try again."); return; }
        outputWindowRef.current = popup;
        setOutputWindow(popup);
        setFullscreenError("");
      }}>Open output window</button>
      <button aria-pressed={rollingPaused} onClick={() => setRollingPaused(value => !value)}>{rollingPaused ? "Resume results bar" : "Pause results bar"}</button>
      <button aria-pressed={overallPaused} onClick={() => setOverallPaused(value => !value)}>{overallPaused ? "Resume overall rotation" : "Pause overall rotation"}</button>
      <button aria-pressed={previewAlert} onClick={() => setPreviewAlert(value => !value)}>{previewAlert ? "Hide alert preview" : "Preview alert bar"}</button>
      <button onClick={() => setControls(false)}>Hide desk (H)</button>
      <p>Test feed only. Choose a constituency and release one count at a time. Play runs graphics and alerts; results arrive only when released. Press H to show or hide this desk. {fullscreenError}</p>
    </section>}
    {outputWindow && <BroadcastWindow popup={outputWindow} light={!showingConstituency} onClose={() => { outputWindowRef.current = null; setOutputWindow(null); }}>{programme}</BroadcastWindow>}
  </main>;
}
