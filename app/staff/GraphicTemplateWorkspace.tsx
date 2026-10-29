"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PARTY_BY_CODE, type ElectionArchiveArea, type ElectionArchiveEntry, type GraphicTemplateKey } from "@/lib/staff/pollingGraphicCatalog";

type Props = { template: GraphicTemplateKey; elections: ElectionArchiveEntry[] };
const TITLES: Record<GraphicTemplateKey, string> = {
  polling: "Polling graphics", "breaking-news": "Breaking news", "on-this-day": "#OnThisDay",
  "election-results": "Election results", explainer: "Explainers & stats",
};
const DEFAULT_HEADLINES: Record<GraphicTemplateKey, string> = {
  polling: "", "breaking-news": "BREAKING", "on-this-day": "On this day",
  "election-results": "Election results", explainer: "The numbers behind the story",
};
const BREAKING_FLASH_LINES = ["BREAK", "ING"];
const dateLabel = (value: string | null) => value ? new Intl.DateTimeFormat("en-IE", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)) : "Election archive";
function lines(value: string, max = 28, limit = 3) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  const result: string[] = [];
  let line = "";
  for (const word of words) {
    if (line && `${line} ${word}`.length > max) { result.push(line); line = word; }
    else line = line ? `${line} ${word}` : word;
  }
  if (line) result.push(line);
  if (result.length > limit) result.splice(limit - 1, result.length - limit + 1, `${result[limit - 1].slice(0, max - 1).trimEnd()}…`);
  return result.length ? result : [""];
}

function wrapWords(value: string, maxCharacters: number) {
  const result: string[] = [];
  let current = "";
  const words = value.trim().split(/\s+/).filter(Boolean).flatMap((word) => {
    if (word.length <= maxCharacters) return [word];
    return Array.from({ length: Math.ceil(word.length / maxCharacters) }, (_, index) => word.slice(index * maxCharacters, (index + 1) * maxCharacters));
  });
  for (const word of words) {
    if (current && `${current} ${word}`.length > maxCharacters) { result.push(current); current = word; }
    else current = current ? `${current} ${word}` : word;
  }
  if (current) result.push(current);
  return result.length ? result : [""];
}

function fitBreakingSummary(value: string, width: number, height: number) {
  for (let fontSize = 180; fontSize >= 44; fontSize -= 4) {
    const wrapped = wrapWords(value, Math.max(10, Math.floor(width / (fontSize * 0.54))));
    const lineHeight = Math.round(fontSize * 1.12);
    if (wrapped.length * lineHeight <= height) return { lines: wrapped, fontSize, lineHeight };
  }
  const fontSize = 44;
  const lineHeight = Math.round(fontSize * 1.12);
  const maxLines = Math.max(1, Math.floor(height / lineHeight));
  const wrapped = wrapWords(value, Math.max(10, Math.floor(width / (fontSize * 0.54))));
  if (wrapped.length > maxLines) {
    wrapped.splice(maxLines);
    wrapped[maxLines - 1] = `${wrapped[maxLines - 1].slice(0, -1).trimEnd()}…`;
  }
  return { lines: wrapped, fontSize, lineHeight };
}

type GifFrame = { x: number; y: number; width: number; height: number; pixels: Uint8ClampedArray; delay: number };

function encodeGif(width: number, height: number, frames: GifFrame[]) {
  const bytes: number[] = [];
  const writeWord = (value: number) => { bytes.push(value & 255, (value >> 8) & 255); };
  const writeText = (value: string) => { for (const char of value) bytes.push(char.charCodeAt(0)); };
  const writeSubBlocks = (data: number[]) => {
    for (let offset = 0; offset < data.length; offset += 255) {
      const block = data.slice(offset, offset + 255);
      bytes.push(block.length, ...block);
    }
    bytes.push(0);
  };
  type SampleColor = { bin: number; count: number; red: number; green: number; blue: number };
  const samples = new Map<number, SampleColor>();
  for (const frame of frames) {
    for (let pixel = 0; pixel < width * height; pixel += 8) {
      const offset = pixel * 4;
      const red = frame.pixels[offset]; const green = frame.pixels[offset + 1]; const blue = frame.pixels[offset + 2];
      const bin = ((red >> 3) << 10) | ((green >> 3) << 5) | (blue >> 3);
      const sample = samples.get(bin) ?? { bin, count: 0, red: 0, green: 0, blue: 0 };
      const weight = Math.max(1, frame.delay);
      sample.count += weight; sample.red += red * weight; sample.green += green * weight; sample.blue += blue * weight;
      samples.set(bin, sample);
    }
  }
  const sampledColors = [...samples.values()].map((sample) => ({
    ...sample,
    r: sample.red / sample.count,
    g: sample.green / sample.count,
    b: sample.blue / sample.count,
  }));
  const channelRange = (colors: typeof sampledColors, channel: "r" | "g" | "b") => {
    const values = colors.map((color) => color[channel]);
    return Math.max(...values) - Math.min(...values);
  };
  const palette: Array<{ r: number; g: number; b: number }> = [];
  const boxes = [sampledColors];
  while (boxes.length < 256) {
    let splitIndex = -1; let splitScore = -1; let splitChannel: "r" | "g" | "b" = "r";
    boxes.forEach((box, index) => {
      if (box.length < 2) return;
      const ranges = { r: channelRange(box, "r"), g: channelRange(box, "g"), b: channelRange(box, "b") };
      const channel = ranges.r >= ranges.g && ranges.r >= ranges.b ? "r" : ranges.g >= ranges.b ? "g" : "b";
      const weight = box.reduce((total, color) => total + color.count, 0);
      const score = ranges[channel] * Math.sqrt(weight);
      if (score > splitScore) { splitIndex = index; splitScore = score; splitChannel = channel; }
    });
    if (splitIndex < 0) break;
    const box = boxes.splice(splitIndex, 1)[0].sort((left, right) => left[splitChannel] - right[splitChannel]);
    const halfway = box.reduce((total, color) => total + color.count, 0) / 2;
    let accumulated = 0; let boundary = 0;
    while (boundary < box.length - 1 && accumulated < halfway) accumulated += box[boundary++].count;
    boxes.push(box.slice(0, boundary), box.slice(boundary));
  }
  for (const box of boxes) {
    const totals = box.reduce((total, color) => ({
      weight: total.weight + color.count,
      r: total.r + color.r * color.count,
      g: total.g + color.g * color.count,
      b: total.b + color.b * color.count,
    }), { weight: 0, r: 0, g: 0, b: 0 });
    palette.push({ r: totals.r / totals.weight, g: totals.g / totals.weight, b: totals.b / totals.weight });
  }
  const paletteLookup = new Uint8Array(32768);
  for (let bin = 0; bin < paletteLookup.length; bin += 1) {
    const red = ((bin >> 10) & 31) * 8 + 4; const green = ((bin >> 5) & 31) * 8 + 4; const blue = (bin & 31) * 8 + 4;
    let nearest = 0; let nearestDistance = Infinity;
    palette.forEach((color, index) => {
      const distance = (red - color.r) ** 2 + (green - color.g) ** 2 + (blue - color.b) ** 2;
      if (distance < nearestDistance) { nearest = index; nearestDistance = distance; }
    });
    paletteLookup[bin] = nearest;
  }
  const compress = (indices: Uint8Array) => {
    const output: number[] = [];
    let accumulator = 0;
    let bitCount = 0;
    let nextCode = 258;
    let dictionary = new Map<number, number>();
    const writeCode = (code: number) => {
      accumulator |= code << bitCount;
      bitCount += 9;
      while (bitCount >= 8) { output.push(accumulator & 255); accumulator >>>= 8; bitCount -= 8; }
    };
    const clearCode = () => { writeCode(256); dictionary = new Map<number, number>(); nextCode = 258; };
    clearCode();
    if (indices.length) {
      let prefix = indices[0];
      for (let i = 1; i < indices.length; i += 1) {
        const symbol = indices[i];
        const key = prefix * 256 + symbol;
        const found = dictionary.get(key);
        if (found !== undefined) { prefix = found; continue; }
        writeCode(prefix);
        if (nextCode < 500) {
          dictionary.set(key, nextCode);
          nextCode += 1;
        } else clearCode();
        prefix = symbol;
      }
      writeCode(prefix);
    }
    writeCode(257);
    if (bitCount) output.push(accumulator & 255);
    return output;
  };

  writeText("GIF89a"); writeWord(width); writeWord(height);
  bytes.push(0xf7, 0, 0);
  for (let index = 0; index < 256; index += 1) {
    const color = palette[index] ?? palette[palette.length - 1] ?? { r: 0, g: 0, b: 0 };
    bytes.push(Math.round(color.r), Math.round(color.g), Math.round(color.b));
  }
  bytes.push(0x21, 0xff, 0x0b); writeText("NETSCAPE2.0"); bytes.push(3, 1, 0, 0, 0);

  let previousIndices: Uint8Array | null = null;
  for (const frame of frames) {
    bytes.push(0x21, 0xf9, 4, 0x04); writeWord(frame.delay); bytes.push(0, 0);
    const indices = new Uint8Array(width * height);
    for (let i = 0, p = 0; i < indices.length; i += 1, p += 4) {
      const bin = ((frame.pixels[p] >> 3) << 10) | ((frame.pixels[p + 1] >> 3) << 5) | (frame.pixels[p + 2] >> 3);
      indices[i] = paletteLookup[bin];
    }
    let left = 0; let top = 0; let right = width - 1; let bottom = height - 1;
    if (previousIndices) {
      left = width; top = height; right = -1; bottom = -1;
      for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
        const index = y * width + x;
        if (indices[index] !== previousIndices[index]) { left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y); }
      }
      if (right < left || bottom < top) { left = 0; top = 0; right = 0; bottom = 0; }
    }
    const frameWidth = right - left + 1;
    const frameHeight = bottom - top + 1;
    const croppedIndices = new Uint8Array(frameWidth * frameHeight);
    for (let y = 0; y < frameHeight; y += 1) croppedIndices.set(indices.subarray((top + y) * width + left, (top + y) * width + left + frameWidth), y * frameWidth);
    bytes.push(0x2c); writeWord(left); writeWord(top); writeWord(frameWidth); writeWord(frameHeight); bytes.push(0);
    bytes.push(8);
    writeSubBlocks(compress(croppedIndices));
    previousIndices = indices;
  }
  bytes.push(0x3b);
  return new Blob([new Uint8Array(bytes)], { type: "image/gif" });
}

export default function GraphicTemplateWorkspace({ template, elections }: Props) {
  const previewRef = useRef<SVGSVGElement>(null);
  const firstElection = elections[0];
  const [headline, setHeadline] = useState(DEFAULT_HEADLINES[template]);
  const [summary, setSummary] = useState("");
  const [source, setSource] = useState("");
  const [stat, setStat] = useState("");
  const [statLabel, setStatLabel] = useState("");
  const [preparedDate, setPreparedDate] = useState(new Date().toISOString().slice(0, 10));
  const [electionId, setElectionId] = useState(firstElection?.id ?? "");
  const [areaName, setAreaName] = useState(firstElection?.areas[0]?.name ?? "");
  const [breakingMode, setBreakingMode] = useState<"static" | "animated">(template === "breaking-news" ? "animated" : "static");
  const [breakingTypedCharacters, setBreakingTypedCharacters] = useState(0);
  const [tweetDraft, setTweetDraft] = useState("");
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [postOpen, setPostOpen] = useState(false);
  const [postImage, setPostImage] = useState("");
  const [preparingPost, setPreparingPost] = useState(false);
  const [xStatus, setXStatus] = useState<{ loading: boolean; connected: boolean; configured: boolean; username?: string }>({ loading: false, connected: false, configured: false });
  const [publishing, setPublishing] = useState(false);
  const [postError, setPostError] = useState("");
  const [postedUrl, setPostedUrl] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [mobilePanel, setMobilePanel] = useState<"edit" | "preview">("edit");

  const election = elections.find((item) => item.id === electionId) ?? firstElection;
  const area: ElectionArchiveArea | undefined = election?.areas.find((item) => item.name === areaName) ?? election?.areas[0];
  const isArchive = template === "on-this-day" || template === "election-results";
  const topParties = useMemo(() => area?.parties.slice(0, 6) ?? [], [area]);
  const topCandidates = useMemo(() => area?.candidates.slice(0, 5) ?? [], [area]);
  const isBreakingGraphic = template === "breaking-news";
  const titleLines = useMemo(() => lines(headline || DEFAULT_HEADLINES[template], isBreakingGraphic ? 34 : template === "explainer" ? 27 : 25, isBreakingGraphic ? 2 : 3), [headline, template, isBreakingGraphic]);
  const breakingAccentY = isBreakingGraphic ? 270 + Math.max(0, titleLines.length - 1) * 90 + 50 : 636;
  const breakingSummaryY = isBreakingGraphic ? breakingAccentY + 215 : 680;
  const breakingSummaryLayout = useMemo(() => fitBreakingSummary(summary, 1880, Math.max(90, 935 - breakingSummaryY)), [summary, breakingSummaryY]);
  const contentLines = isBreakingGraphic
    ? breakingSummaryLayout.lines
    : lines(summary, template === "explainer" ? 44 : 35, 4);
  useEffect(() => { setBreakingMode(template === "breaking-news" ? "animated" : "static"); }, [template]);
  useEffect(() => {
    if (template !== "breaking-news" || breakingMode !== "animated") { setBreakingTypedCharacters(0); return; }
    setBreakingTypedCharacters(0);
    const timer = window.setInterval(() => setBreakingTypedCharacters((count) => Math.min(count + 1, 8)), 40);
    return () => window.clearInterval(timer);
  }, [breakingMode, template]);
  const postText = useMemo(() => {
    const titleText = headline || DEFAULT_HEADLINES[template];
    if (template === "breaking-news") return `BREAK:\n\n${summary.trim()}${source.trim() ? `\n\nvia ${source.trim()}` : ""}`;
    if (template === "on-this-day" && election) {
      const figures = (area?.parties ?? []).slice(0, 3).map((party) => `${party.code} ${party.share.toFixed(1)}%${party.elected ? ` · ${party.elected} seat${party.elected === 1 ? "" : "s"}` : ""}`);
      return [`#OnThisDay · ${dateLabel(election.date)}`, `${election.label}${area?.name && area.name !== "National" ? ` — ${area.name}` : ""}`, "", ...figures, summary, "", "Ireland Votes"].filter(Boolean).join("\n");
    }
    if (template === "election-results" && election) {
      return [`${election.label}${area?.name && area.name !== "National" ? ` — ${area.name}` : ""}`, ...((area?.parties ?? []).slice(0, 3).map((party) => `${party.code}: ${party.share.toFixed(1)}%${party.elected ? ` · ${party.elected} seat${party.elected === 1 ? "" : "s"}` : ""}`)), "", summary, "", "#ElectionResults #IrelandVotes"].filter(Boolean).join("\n");
    }
    if (template === "explainer") return [`${titleText}`, stat ? `${stat}${statLabel ? ` — ${statLabel}` : ""}` : "", "", summary, source ? `Source: ${source}` : "", "", "Ireland Votes"].filter(Boolean).join("\n");
    return [titleText.toUpperCase() === "BREAKING" ? "BREAKING" : `BREAKING · ${titleText}`, summary, source ? `Source: ${source}` : "", "", "Ireland Votes"].filter(Boolean).join("\n");
  }, [area, election, headline, source, stat, statLabel, summary, template]);

  useEffect(() => { setTweetDraft(postText); }, [postText]);
  useEffect(() => {
    if (!postOpen) return;
    let alive = true;
    setXStatus((value) => ({ ...value, loading: true }));
    fetch("/api/staff/x/status", { cache: "no-store" }).then(async (response) => response.json() as Promise<{ configured?: boolean; connected?: boolean; username?: string }>).then((data) => {
      if (alive) setXStatus({ loading: false, configured: Boolean(data.configured), connected: Boolean(data.connected), username: data.username });
    }).catch(() => { if (alive) setXStatus({ loading: false, configured: false, connected: false }); });
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setPostOpen(false); };
    window.addEventListener("keydown", close);
    return () => { alive = false; window.removeEventListener("keydown", close); };
  }, [postOpen]);

  function selectElection(id: string) {
    const selected = elections.find((item) => item.id === id);
    setElectionId(id);
    setAreaName(selected?.areas[0]?.name ?? "");
  }

  async function embedFonts(svg: SVGSVGElement) {
    const assets = await Promise.all([
      ["/fonts/AvertaDemo-Regular.otf", "font/otf"], ["/fonts/AvertaDemo-Semibold.otf", "font/otf"],
      ["/fonts/AvertaDemo-Bold.otf", "font/otf"], ["/portrait.png", "image/png"],
    ] as const);
    const data = await Promise.all(assets.map(async ([path, mime]) => {
      const response = await fetch(path);
      if (!response.ok) throw new Error("A brand asset could not be loaded.");
      const bytes = new Uint8Array(await response.arrayBuffer());
      let binary = "";
      for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
      return `data:${mime};base64,${btoa(binary)}`;
    }));
    svg.querySelector('[data-asset="logo"]')?.setAttribute("href", data[3]);
    const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
    style.textContent = `@font-face{font-family:AvertaExport;src:url('${data[0]}') format('opentype');font-weight:400}@font-face{font-family:AvertaExport;src:url('${data[1]}') format('opentype');font-weight:600}@font-face{font-family:AvertaExport;src:url('${data[2]}') format('opentype');font-weight:700}`;
    svg.insertBefore(style, svg.firstChild);
  }

  async function makePng(): Promise<Blob> {
    if (!previewRef.current) throw new Error("The graphic preview is not ready.");
    await document.fonts.ready;
    const svg = previewRef.current.cloneNode(true) as SVGSVGElement;
    svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    svg.querySelector("[data-motion-style]")?.remove();
    const motionHeadline = svg.querySelector<SVGGElement>("[data-motion-headline]");
    motionHeadline?.removeAttribute("class");
    motionHeadline?.setAttribute("opacity", "1");
    motionHeadline?.removeAttribute("transform");
    const motionAccent = svg.querySelector<SVGRectElement>("[data-motion-accent]");
    if (motionAccent) motionAccent.setAttribute("width", "280");
    await embedFonts(svg);
    const image = new Image();
    const objectUrl = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml;charset=utf-8" }));
    try {
      image.src = objectUrl;
      await image.decode();
      const canvas = document.createElement("canvas"); canvas.width = 4000; canvas.height = 2000;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("PNG export is unavailable in this browser.");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("The PNG could not be created.");
      return blob;
    } finally { URL.revokeObjectURL(objectUrl); }
  }

  async function makeGif(): Promise<Blob> {
    if (!previewRef.current) throw new Error("The graphic preview is not ready.");
    await document.fonts.ready;
    await document.fonts.load("700 700px AvertaExport");
    const width = 1200;
    const height = 600;
    const scale = width / 2048;
    const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("GIF export is unavailable in this browser.");
    const logo = new Image(); logo.src = "/portrait.png"; await logo.decode();
    const framePixels: GifFrame[] = [];
    const drawFrame = (typedCharacters: number, yOffset: number, delay: number) => {
      context.fillStyle = "#d84654"; context.fillRect(0, 0, width, height);
      context.save(); context.fillStyle = "#fff2f3"; context.shadowColor = "rgba(86, 10, 18, .3)"; context.shadowBlur = 22 * scale;
      context.font = `700 ${700 * scale}px AvertaExport, Arial, sans-serif`; context.textAlign = "left"; context.textBaseline = "alphabetic";
      let remaining = typedCharacters;
      BREAKING_FLASH_LINES.forEach((line, lineIndex) => {
        const visibleCharacters = Math.min(line.length, remaining);
        const baseline = (lineIndex === 0 ? 470 : 1040) * scale + yOffset * scale;
        if (visibleCharacters > 0) context.fillText(line.slice(0, visibleCharacters), -112 * scale, baseline);
        remaining -= line.length;
      });
      context.restore();
      context.drawImage(logo, 1690 * scale, 875 * scale, 280 * scale, 114 * scale);
      framePixels.push({ x: 0, y: 0, width, height, pixels: context.getImageData(0, 0, width, height).data, delay });
    };
    for (let frame = 1; frame <= 8; frame += 1) drawFrame(frame, 125 * (1 - frame / 8), 4);
    drawFrame(8, 0, 120);
    drawFrame(0, 0, 8);
    return encodeGif(width, height, framePixels);
  }

  async function makeSelectedGraphic(): Promise<Blob> {
    return template === "breaking-news" && breakingMode === "animated" ? makeGif() : makePng();
  }

  async function download() {
    setExporting(true); setError("");
    try {
      const animated = template === "breaking-news" && breakingMode === "animated";
      const blob = animated ? await makeGif() : await makePng(); const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `ireland-votes-${template}.${animated ? "gif" : "png"}`; anchor.click(); URL.revokeObjectURL(url);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The graphic could not be exported."); }
    finally { setExporting(false); }
  }

  async function openPost() {
    setPreparingPost(true);
    setPostError(""); setPostedUrl("");
    try {
      const blob = await makeSelectedGraphic(); const url = URL.createObjectURL(blob); setPostImage((old) => { if (old) URL.revokeObjectURL(old); return url; });
      setPostOpen(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not prepare the post preview."); }
    finally { setPreparingPost(false); }
  }

  async function publish() {
    setPublishing(true); setPostError("");
    try {
      if (!postImage) throw new Error("Prepare the graphic preview first.");
      const responseBlob = await fetch(postImage).then((response) => response.blob());
      const animated = template === "breaking-news" && breakingMode === "animated";
      const form = new FormData(); form.set("text", tweetDraft); form.set("graphic", responseBlob, `ireland-votes-${template}.${animated ? "gif" : "png"}`);
      const response = await fetch("/api/staff/x/post", { method: "POST", body: form });
      const result = await response.json() as { error?: string; postUrl?: string; posted?: boolean };
      if (!response.ok || !result.posted || !result.postUrl) throw new Error(result.error ?? "X could not publish this post.");
      setPostedUrl(result.postUrl);
    } catch (cause) { setPostError(cause instanceof Error ? cause.message : "X could not publish this post."); }
    finally { setPublishing(false); }
  }

  async function copyPost() {
    try { await navigator.clipboard.writeText(tweetDraft); setCopyStatus("Copied"); }
    catch { setCopyStatus("Copy failed"); }
  }

  function textLines(items: string[], x: number, y: number, size: number, lineHeight: number, color = "#f4f8f8", weight = 500) {
    return <text x={x} y={y} fill={color} fontFamily="AvertaExport, Averta, Arial, sans-serif" fontSize={size} fontWeight={weight} letterSpacing="-1.2">{items.map((line, index) => <tspan key={`${index}-${line}`} x={x} dy={index ? lineHeight : 0}>{line}</tspan>)}</text>;
  }

  return <div className="staff-workspace-content">
    <div className="staff-mobile-tabs" aria-label="Graphic editor view"><button type="button" aria-pressed={mobilePanel === "edit"} onClick={() => setMobilePanel("edit")}>Edit graphic</button><button type="button" aria-pressed={mobilePanel === "preview"} onClick={() => setMobilePanel("preview")}>Preview</button></div>
    <div className="staff-tool-layout" data-mobile-panel={mobilePanel}>
      <aside className="staff-editor">
        <div className="staff-tool-heading"><p className="staff-eyebrow">IRELAND VOTES / CONTENT</p><h1>{TITLES[template]}</h1><p>Build a branded social graphic and prepare its post copy.</p></div>
        <section className="staff-editor-section"><h2>Graphic content</h2>
          {template === "breaking-news" && <fieldset className="staff-breaking-mode"><legend>Format</legend><div role="group" aria-label="Breaking news graphic format"><button type="button" aria-pressed={breakingMode === "static"} onClick={() => setBreakingMode("static")}>Static</button><button type="button" aria-pressed={breakingMode === "animated"} onClick={() => setBreakingMode("animated")}>Animated GIF</button></div><p>The animated GIF is a looping generic BREAKING flash with the Ireland Votes logo. Use the static format for the story summary and source.</p></fieldset>}
          <label>Headline<input value={headline} onChange={(event) => setHeadline(event.target.value)} maxLength={100} /></label>
          <label>{template === "explainer" ? "Explanation" : template === "breaking-news" ? "Summary" : "Context / caption"}<textarea rows={4} value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="Add the key detail for the graphic" /></label>
          {isBreakingGraphic && <p className="staff-field-note">The summary automatically scales to the available space while using the full width.</p>}
          {template === "breaking-news" && <>
            <label>Source<input value={source} onChange={(event) => setSource(event.target.value)} placeholder="e.g. Official statement" /></label>
          </>}
          {template === "explainer" && <div className="staff-generic-inline-fields"><label>Key figure<input value={stat} onChange={(event) => setStat(event.target.value)} placeholder="e.g. 12.4%" /></label><label>Figure label<input value={statLabel} onChange={(event) => setStatLabel(event.target.value)} placeholder="e.g. turnout" /></label></div>}
          {template === "explainer" && <label>Source<input value={source} onChange={(event) => setSource(event.target.value)} placeholder="Dataset / publication" /></label>}
          {template === "breaking-news" && <label>Prepared date<input type="date" value={preparedDate} onChange={(event) => setPreparedDate(event.target.value)} /></label>}
        </section>
        {isArchive && <section className="staff-editor-section"><h2>Election archive</h2>
          {elections.length ? <>
            <label>Election<select value={election?.id ?? ""} onChange={(event) => selectElection(event.target.value)}>{elections.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            <label>{template === "election-results" ? "Constituency / area" : "Area"}<select value={area?.name ?? ""} onChange={(event) => setAreaName(event.target.value)}>{(election?.areas ?? []).map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select></label>
            {template === "on-this-day" && <label>Graphic date<input type="date" value={preparedDate} onChange={(event) => setPreparedDate(event.target.value)} /></label>}
            <p className="staff-field-note">Archive figures are drawn from the selected election dataset. Verify the figures and add context before publishing.</p>
          </> : <p className="staff-field-note">No election result datasets were found for these templates.</p>}
        </section>}
        {error && <p className="staff-form-error" role="alert">{error}</p>}
      </aside>
      <section className="staff-preview-area">
        <div className="staff-preview-toolbar"><div><p className="staff-eyebrow">{template === "breaking-news" && breakingMode === "animated" ? "ANIMATED GIF · LOOPING" : "4000 × 2000"}</p><h2>Live preview</h2></div><button type="button" className="staff-generate-post-button" onClick={() => { void openPost(); }} disabled={preparingPost}>{preparingPost ? "Preparing post…" : "Generate post"}</button><button type="button" className="staff-download-button" onClick={() => { void download(); }} disabled={exporting}>{exporting ? "Preparing file…" : template === "breaking-news" && breakingMode === "animated" ? "Download GIF" : "Download PNG"}</button></div>
        <div className="staff-preview-frame">
          <svg ref={previewRef} className="poll-graphic-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 1024" role="img" aria-label={`${TITLES[template]} graphic preview`}>
            <defs><linearGradient id="studio-bg" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#101719"/><stop offset="1" stopColor="#243337"/></linearGradient><linearGradient id="studio-aqua" x1="0" y1="0" x2="1" y2="1"><stop stopColor={isBreakingGraphic ? "#f4a3aa" : "#00d7e6"} stopOpacity=".46"/><stop offset="1" stopColor={isBreakingGraphic ? "#a93d47" : "#008b97"} stopOpacity="0"/></linearGradient><radialGradient id="studio-glow"><stop stopColor={isBreakingGraphic ? "#e65d69" : "#00c7d4"} stopOpacity=".29"/><stop offset="1" stopColor={isBreakingGraphic ? "#e65d69" : "#00c7d4"} stopOpacity="0"/></radialGradient></defs>
            {isBreakingGraphic && breakingMode === "animated" && <style data-motion-style>{`@keyframes ivFlashRise{0%{transform:translateY(150px)}100%{transform:translateY(0)}}[data-breaking-flash-word]{animation:ivFlashRise .32s cubic-bezier(.2,.75,.25,1) both}@media(prefers-reduced-motion:reduce){[data-breaking-flash-word]{animation:none}}`}</style>}
            <rect width="2048" height="1024" fill="url(#studio-bg)"/><circle cx="1690" cy="460" r="650" fill="url(#studio-glow)"/><path d="M1170 0h878v1024h-120z" fill="url(#studio-aqua)" opacity=".38"/>{!isBreakingGraphic && <path d="M0 905h2048" stroke="#d9eef0" strokeOpacity=".18"/>}<image data-asset="logo" data-breaking-reveal="brand" href="/portrait.png" x="72" y="48" width="310" height="126" preserveAspectRatio="xMinYMid meet"/>
            {!isBreakingGraphic && <text x="82" y="224" fill="#00d7e6" fontFamily="AvertaExport,Arial,sans-serif" fontSize="28" fontWeight="700" letterSpacing="5">{template === "on-this-day" ? "FROM THE ARCHIVE" : template === "election-results" ? "ELECTION RESULTS" : "IRELAND VOTES / EXPLAINER"}</text>}
            <g data-motion-headline={isBreakingGraphic ? "true" : undefined} data-breaking-reveal={isBreakingGraphic ? "headline" : undefined}>{textLines(titleLines, 82, isBreakingGraphic ? 285 : 340, isBreakingGraphic ? 82 : template === "explainer" ? 78 : 96, isBreakingGraphic ? 90 : 110, isBreakingGraphic ? "#f4a3aa" : "#f6f8f8", 700)}</g>
            {isBreakingGraphic && <rect data-motion-accent="true" data-breaking-reveal="accent" x="82" y={breakingAccentY} width="280" height="5" rx="2.5" fill="#f4a3aa"/>}
            {template === "explainer" && <><text x="90" y="715" fill="#00d7e6" fontFamily="AvertaExport,Arial,sans-serif" fontSize="142" fontWeight="700" letterSpacing="-8">{lines(stat || "—", 12, 1)[0]}</text><text x="98" y="774" fill="#e0e8e9" fontFamily="AvertaExport,Arial,sans-serif" fontSize="30">{statLabel}</text></>}
            {isArchive && <>
              <text x="84" y="478" fill="#b9c9cb" fontFamily="AvertaExport,Arial,sans-serif" fontSize="32" fontWeight="600">{election?.label ?? "Select an election"}</text>
              <text x="84" y="528" fill="#8fa3a6" fontFamily="AvertaExport,Arial,sans-serif" fontSize="25">{area?.name ?? ""} · {dateLabel(election?.date ?? null)}</text>
              <g transform="translate(84 595)">{topParties.map((party, index) => <g key={party.code} transform={`translate(0 ${index * 60})`}><rect width="700" height="44" rx="8" fill="#f5f8f8" fillOpacity=".09"/><text x="18" y="30" fill="#f7f9f9" fontFamily="AvertaExport,Arial,sans-serif" fontSize="24" fontWeight="700">{party.code}</text><rect x="130" y="11" width={Math.max(4, party.share * 4.6)} height="22" rx="11" fill={PARTY_BY_CODE[party.code]?.color ?? "#4f9bd4"}/><text x="680" y="30" textAnchor="end" fill="#e9f0f0" fontFamily="AvertaExport,Arial,sans-serif" fontSize="22">{party.share.toFixed(1)}%{party.elected ? `  ·  ${party.elected} seat${party.elected === 1 ? "" : "s"}` : ""}</text></g>)}</g>
              {template === "election-results" && topCandidates.length > 0 && <text x="1270" y="866" fill="#dce8e9" fontFamily="AvertaExport,Arial,sans-serif" fontSize="23">{topCandidates.slice(0, 3).map((candidate) => `${candidate.party} ${candidate.share.toFixed(1)}%`).join("     ·     ")}</text>}
            </>}
            {isBreakingGraphic && <g data-breaking-reveal="summary">{textLines(contentLines, 84, breakingSummaryY, breakingSummaryLayout.fontSize, breakingSummaryLayout.lineHeight, "#f6f8f8", 600)}</g>}
            {template === "on-this-day" && textLines(contentLines, 840, 675, 28, 41, "#d6e1e2", 400)}
            {template === "election-results" && textLines(contentLines, 840, 675, 28, 41, "#d6e1e2", 400)}
            {template === "explainer" && textLines(contentLines, 1040, 525, 30, 44, "#d6e1e2", 400)}
            {isBreakingGraphic && <g data-breaking-reveal="footer">{source && <text x="84" y="970" fill="#f4a3aa" fontFamily="AvertaExport,Arial,sans-serif" fontSize="24" fontWeight="600">SOURCE  /  {source}</text>}<text x="1960" y="970" textAnchor="end" fill="#a4b5b7" fontFamily="AvertaExport,Arial,sans-serif" fontSize="20">{dateLabel(preparedDate)}</text></g>}
            {template === "explainer" && source && <text x="1040" y="832" fill="#acbec0" fontFamily="AvertaExport,Arial,sans-serif" fontSize="23">SOURCE  /  {source}</text>}
            {!isBreakingGraphic && <><text x="84" y="970" fill="#a4b5b7" fontFamily="AvertaExport,Arial,sans-serif" fontSize="20" letterSpacing="1">IRELAND VOTES</text><text x="1960" y="970" textAnchor="end" fill="#a4b5b7" fontFamily="AvertaExport,Arial,sans-serif" fontSize="20">{dateLabel(preparedDate)}</text></>}
            {isBreakingGraphic && breakingMode === "animated" && <g data-breaking-flash="true" pointerEvents="none"><rect width="2048" height="1024" fill="#d84654"/><g data-breaking-flash-word="true" fill="#fff2f3" fontFamily="AvertaExport,Arial,sans-serif" fontSize="700" fontWeight="700" letterSpacing="-18" textAnchor="start" style={{ transformOrigin: "center" }}><text x="-112" y="470">{BREAKING_FLASH_LINES[0].slice(0, breakingTypedCharacters)}</text><text x="-112" y="1040">{BREAKING_FLASH_LINES[1].slice(0, Math.max(0, breakingTypedCharacters - BREAKING_FLASH_LINES[0].length))}</text></g><image href="/portrait.png" x="1690" y="875" width="280" height="114" preserveAspectRatio="xMaxYMax meet"/></g>}
          </svg>
        </div>
        <p className="staff-export-note">Ireland Votes brand fonts embedded · {template === "breaking-news" && breakingMode === "animated" ? "Looping animated GIF · 1200 × 600" : "High-resolution PNG · 2:1 social format"}</p>
      </section>
    </div>
    {postOpen && <div className="staff-post-drawer-layer"><button type="button" className="staff-post-drawer-backdrop" aria-label="Close post generator" onClick={() => setPostOpen(false)}/><aside className="staff-post-drawer" role="dialog" aria-modal="true" aria-labelledby="generic-post-title"><header className="staff-post-drawer-header"><div><p className="staff-eyebrow">SOCIAL MEDIA</p><h2 id="generic-post-title">Generate post</h2></div><button type="button" className="staff-post-drawer-close" onClick={() => setPostOpen(false)}>Close</button></header><div className="staff-post-drawer-content"><div className="staff-post-platform"><span className="staff-post-platform-icon">X</span><div><strong>Twitter / X</strong><span>{TITLES[template]} template</span></div></div><div className={`staff-x-connection${xStatus.connected ? " is-connected" : ""}`}>{xStatus.loading ? <span>Checking X connection…</span> : xStatus.connected ? <span><strong>Connected</strong> as @{xStatus.username}</span> : xStatus.configured ? <><span>Connect the Ireland Votes account to publish.</span><a href="/api/staff/x/connect">Connect X account</a></> : <span>X publishing is not configured on this server.</span>}</div><label className="staff-post-copy-label" htmlFor="generic-post-copy">Post text <span>{Array.from(tweetDraft).length} characters</span></label><textarea id="generic-post-copy" className="staff-tweet-draft" value={tweetDraft} onChange={(event) => setTweetDraft(event.target.value)}/><article className="staff-x-post-preview"><div className="staff-x-post-author"><span className="staff-x-post-avatar">IV</span><span><strong>Ireland Votes</strong><small>Polling &amp; electoral analysis</small></span><b>X</b></div><p className="staff-x-post-text">{tweetDraft}</p>{postImage && <img className="staff-x-post-image" src={postImage} alt={`${TITLES[template]} graphic attached to post`}/>}</article>{postError && <p className="staff-post-error" role="alert">{postError}</p>}{postedUrl && <p className="staff-post-success" role="status">Published. <a href={postedUrl} target="_blank" rel="noreferrer">View post on X</a></p>}</div><footer className="staff-post-drawer-footer"><span className="staff-post-copy-status">{copyStatus}</span><button type="button" className="staff-copy-tweet-button" onClick={() => { void copyPost(); }}>Copy post</button><button type="button" className="staff-post-now-button" disabled={!xStatus.connected || xStatus.loading || publishing || Boolean(postedUrl)} onClick={() => { void publish(); }}>{publishing ? "Publishing…" : postedUrl ? "Published" : "Post to X"}</button></footer></aside></div>}
  </div>;
}
