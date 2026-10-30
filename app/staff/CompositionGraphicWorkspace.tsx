"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { CompositionParty, CompositionTemplate } from "@/lib/staff/compositionData";

type ChangeKind = "By-election" | "Affiliation change" | "Custom adjustment";
type SeatChange = { id: number; kind: ChangeKind; from: string; to: string; seats: number; constituency: string; note: string };
const GRAPHIC_WIDTH = 1920;
const GRAPHIC_HEIGHT = 1080;
const VACANT_COLOR = "#9ba6a8";

function slug(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "composition";
}

function lightPartyColor(color: string) {
  const match = color.match(/^#([0-9a-f]{6})$/i);
  if (!match) return color;
  const channels = [0, 2, 4].map((offset) => Number.parseInt(match[1].slice(offset, offset + 2), 16));
  return `#${channels.map((channel) => Math.round(channel + (255 - channel) * 0.62).toString(16).padStart(2, "0")).join("")}`;
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

type GraphicPoint = { x: number; y: number };

function chamberSeatTracks(chamberId: CompositionTemplate["id"]): GraphicPoint[][] {
  if (chamberId === "assembly") {
    return Array.from({ length: 4 }, (_, row) => {
      const inset = row * 69;
      const left = 1053 + inset;
      const right = 1747 - inset;
      const top = 220 + inset;
      const bottom = 920;
      const corner = Math.min(120 - row * 20, (right - left) / 2, (bottom - top) / 2);
      const points: GraphicPoint[] = [{ x: left, y: bottom }, { x: left, y: top + corner }];
      for (let step = 0; step <= 18; step += 1) {
        const angle = Math.PI + (Math.PI / 2) * step / 18;
        points.push({ x: left + corner + corner * Math.cos(angle), y: top + corner + corner * Math.sin(angle) });
      }
      points.push({ x: right - corner, y: top });
      for (let step = 0; step <= 18; step += 1) {
        const angle = (-Math.PI / 2) + (Math.PI / 2) * step / 18;
        points.push({ x: right - corner + corner * Math.cos(angle), y: top + corner + corner * Math.sin(angle) });
      }
      points.push({ x: right, y: bottom });
      return points;
    });
  }

  const dailStyle = chamberId === "dail";
  const dailRadii = dailStyle ? [420, 358, 296, 234, 172] : [410, 350, 290, 230, 170, 110];
  return dailRadii.map((radius) => {
    const centerX = 1400;
    const arcCenterY = dailStyle ? 560 : 645;
    const bottom = 940;
    const dailArchScale = dailStyle ? 0.62 : 1;
    const archRadius = radius * dailArchScale;
    const points: GraphicPoint[] = [{ x: centerX - archRadius, y: bottom }, { x: centerX - archRadius, y: arcCenterY }];
    for (let step = 0; step <= 72; step += 1) {
      const angle = Math.PI - Math.PI * step / 72;
      points.push({ x: centerX + archRadius * Math.cos(angle), y: arcCenterY - archRadius * Math.sin(angle) });
    }
    points.push({ x: centerX + archRadius, y: bottom });
    return points;
  });
}

function pathLength(points: GraphicPoint[], sideWeight = 1) {
  return points.slice(1).reduce((length, point, index) => {
    const segmentLength = Math.hypot(point.x - points[index].x, point.y - points[index].y);
    const weight = index === 0 || index === points.length - 2 ? sideWeight : 1;
    return length + segmentLength * weight;
  }, 0);
}

function samplePath(points: GraphicPoint[], count: number, sideWeight = 1, includeEndpoints = false): GraphicPoint[] {
  const segmentLengths = points.slice(1).map((point, index) => Math.hypot(point.x - points[index].x, point.y - points[index].y));
  const weights = segmentLengths.map((_, index) => index === 0 || index === segmentLengths.length - 1 ? sideWeight : 1);
  const weightedLengths = segmentLengths.map((length, index) => length * weights[index]);
  const totalLength = weightedLengths.reduce((sum, length) => sum + length, 0);
  return Array.from({ length: count }, (_, seatIndex) => {
    const targetDistance = includeEndpoints && count > 1
      ? seatIndex * totalLength / (count - 1)
      : (seatIndex + 0.5) * totalLength / count;
    let target = targetDistance;
    let segment = 0;
    while (segment < weightedLengths.length - 1 && target > weightedLengths[segment]) {
      target -= weightedLengths[segment];
      segment += 1;
    }
    const start = points[segment];
    const end = points[segment + 1];
    const ratio = weightedLengths[segment] > 0 ? target / weightedLengths[segment] : 0;
    return { x: start.x + (end.x - start.x) * ratio, y: start.y + (end.y - start.y) * ratio };
  });
}

function chamberSeatPositions(total: number, tracks: GraphicPoint[][]) {
  if (total <= 0 || tracks.length === 0) return [];
  const sideWeight = 1;
  const lengths = tracks.map((track) => pathLength(track, sideWeight));
  const totalLength = lengths.reduce((sum, length) => sum + length, 0);
  const allocations = lengths.map((length) => Math.floor(total * length / totalLength));
  const remainder = total - allocations.reduce((sum, count) => sum + count, 0);
  const fractions = lengths.map((length, index) => ({ index, value: total * length / totalLength - allocations[index] })).sort((a, b) => b.value - a.value);
  for (let index = 0; index < remainder; index += 1) allocations[fractions[index].index] += 1;
  return tracks.flatMap((track, index) => samplePath(track, allocations[index], sideWeight));
}

function pathData(points: GraphicPoint[]) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
}

function isIndependentParty(party: CompositionParty) {
  const code = party.code.trim().toUpperCase();
  return code === "IND" || code === "INDU" || code === "INDN" || /^IND[-_]/.test(code);
}

function orderedParties(parties: CompositionParty[]) {
  return [...parties].sort((a, b) => Number(isIndependentParty(a)) - Number(isIndependentParty(b)) || b.seats - a.seats || a.name.localeCompare(b.name));
}

function trackProgress(point: GraphicPoint, track: GraphicPoint[]) {
  const lengths = track.slice(1).map((end, index) => Math.hypot(end.x - track[index].x, end.y - track[index].y));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  let traversed = 0;
  let closest = { distance: Number.POSITIVE_INFINITY, progress: 0 };
  lengths.forEach((length, index) => {
    const start = track[index];
    const end = track[index + 1];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const ratio = length > 0 ? Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (length * length))) : 0;
    const projectedX = start.x + ratio * dx;
    const projectedY = start.y + ratio * dy;
    const distance = Math.hypot(point.x - projectedX, point.y - projectedY);
    if (distance < closest.distance) closest = { distance, progress: total > 0 ? (traversed + ratio * length) / total : 0 };
    traversed += length;
  });
  return closest;
}

function chamberSeatPartyAssignment(dots: GraphicPoint[], parties: CompositionParty[], chamberId: CompositionTemplate["id"], tracks: GraphicPoint[][]) {
  const partyByCode = new Map(parties.map((item) => [item.code, item]));
  const partyCodes = ["FF", "FG", "IND", "RED", "GP", "AON", "PBPS", "INDIRL", "LAB", "SD", "SF"];
  const assemblyPartyCodes = ["SF", "SDLP", "PBP", "AP", "INDU", "TUV", "UUP", "DUP", "IND"];
  const preferredCodes = chamberId === "assembly" ? assemblyPartyCodes : chamberId === "dail" ? partyCodes : [];
  const ordered = preferredCodes.length
    ? (() => {
      const preferred = preferredCodes.map((code) => partyByCode.get(code)).filter((item): item is CompositionParty => Boolean(item));
      const remaining = orderedParties(parties).filter((item) => !preferredCodes.includes(item.code));
      return [
        ...preferred.filter((item) => !isIndependentParty(item)),
        ...remaining.filter((item) => !isIndependentParty(item)),
        ...orderedParties([...preferred, ...remaining].filter(isIndependentParty)),
      ];
    })()
    : orderedParties(parties);
  const seatOrder = [
    ...ordered.flatMap((item) => Array.from({ length: Math.max(0, Math.floor(item.seats)) }, () => item)),
  ];
  const orderedIndices = dots.map((dot, index) => {
    const trackMatches = tracks.map((track, trackIndex) => ({ trackIndex, ...trackProgress(dot, track) }));
    trackMatches.sort((a, b) => a.distance - b.distance);
    return { index, progress: trackMatches[0]?.progress ?? 0, trackIndex: trackMatches[0]?.trackIndex ?? 0 };
  }).sort((a, b) => a.progress - b.progress || a.trackIndex - b.trackIndex).map(({ index }) => index);
  const vacant: CompositionParty = { code: "VACANT", name: "Vacant", seats: 0, color: VACANT_COLOR };
  const result = dots.map(() => vacant);
  orderedIndices.forEach((dotIndex, orderIndex) => {
    result[dotIndex] = seatOrder[orderIndex] ?? vacant;
  });
  return result;
}

export default function CompositionGraphicWorkspace({ templates }: { templates: CompositionTemplate[] }) {
  const initial = templates[0];
  const [templateId, setTemplateId] = useState(initial.id);
  const [title, setTitle] = useState(initial.title);
  const [date, setDate] = useState(initial.date);
  const [parties, setParties] = useState(initial.parties);
  const [changes, setChanges] = useState<SeatChange[]>([]);
  const [partyName, setPartyName] = useState("");
  const [partyCode, setPartyCode] = useState("");
  const [partyColor, setPartyColor] = useState("#00a9b5");
  const [changeKind, setChangeKind] = useState<ChangeKind>("By-election");
  const [fromParty, setFromParty] = useState(initial.parties[0]?.code ?? "");
  const [toParty, setToParty] = useState(initial.parties[1]?.code ?? initial.parties[0]?.code ?? "");
  const [changeSeats, setChangeSeats] = useState("1");
  const [changeConstituency, setChangeConstituency] = useState("");
  const [changeNote, setChangeNote] = useState("");
  const [previewFontsReady, setPreviewFontsReady] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [tweetDraft, setTweetDraft] = useState("");
  const [postOpen, setPostOpen] = useState(false);
  const [postImage, setPostImage] = useState("");
  const [preparingPost, setPreparingPost] = useState(false);
  const [xStatus, setXStatus] = useState<{ loading: boolean; connected: boolean; configured: boolean; username?: string }>({ loading: false, connected: false, configured: false });
  const [publishing, setPublishing] = useState(false);
  const [postError, setPostError] = useState("");
  const [postedUrl, setPostedUrl] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const svgRef = useRef<SVGSVGElement>(null);
  const selected = templates.find((item) => item.id === templateId) ?? initial;
  const baselineByCode = useMemo(() => Object.fromEntries(selected.parties.map((item) => [item.code, item.seats])), [selected]);
  const sortedParties = useMemo(() => orderedParties(parties), [parties]);
  const totalCurrentSeats = parties.reduce((sum, item) => sum + Math.max(0, item.seats), 0);
  const seatDifference = totalCurrentSeats - selected.totalSeats;
  const titleFontSize = Math.max(30, Math.min(60, 1400 / (Math.max(title.length, 1) * 0.62)));
  const highestPartySeatCount = Math.max(1, ...sortedParties.map((item) => item.seats));
  const partyRowStep = Math.min(84, 700 / Math.max(sortedParties.length, 1));
  const partyRowBarHeight = Math.max(25, Math.min(64, partyRowStep - 12));
  const partySectionCenter = selected.mode === "map" ? 559 : 618;
  const partyListStartY = partySectionCenter - ((sortedParties.length - 1) * partyRowStep + partyRowBarHeight) / 2;

  function selectTemplate(id: CompositionTemplate["id"]) {
    const next = templates.find((item) => item.id === id);
    if (!next) return;
    setTemplateId(id);
    setTitle(next.title);
    setDate(next.date);
    setParties(next.parties.map((item) => ({ ...item })));
    setChanges([]);
    setFromParty(next.parties[0]?.code ?? "");
    setToParty(next.parties[1]?.code ?? next.parties[0]?.code ?? "");
    setChangeConstituency("");
    setChangeNote("");
    setStatusMessage("");
  }

  function updateParty(code: string, update: Partial<CompositionParty>) {
    setParties((current) => current.map((item) => item.code === code ? { ...item, ...update } : item));
  }

  function addParty() {
    const code = partyCode.trim().toUpperCase();
    const name = partyName.trim();
    if (!code || !name || parties.some((item) => item.code === code)) {
      setStatusMessage("Enter a party name and a unique abbreviation.");
      return;
    }
    setParties((current) => [...current, { code, name, seats: 0, color: partyColor }]);
    setPartyName("");
    setPartyCode("");
    setStatusMessage(`${code} added. Set its seats or include it in a seat change.`);
  }

  function applyChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const count = Number(changeSeats);
    if (!toParty || !Number.isInteger(count) || count < 1 || (fromParty && fromParty === toParty)) {
      setStatusMessage("Choose a destination party and a valid number of seats.");
      return;
    }
    const source = parties.find((item) => item.code === fromParty);
    if (source && source.seats < count) {
      setStatusMessage(`${source.code} only has ${source.seats} seat${source.seats === 1 ? "" : "s"} to move.`);
      return;
    }
    setParties((current) => current.map((item) => ({
      ...item,
      seats: item.seats - (item.code === fromParty ? count : 0) + (item.code === toParty ? count : 0),
    })));
    setChanges((current) => [...current, {
      id: Date.now(), kind: changeKind, from: fromParty, to: toParty, seats: count,
      constituency: selected.mode === "map" ? changeConstituency : "", note: changeNote.trim(),
    }]);
    setChangeNote("");
    setStatusMessage("Seat change applied to the composition graphic.");
  }

  function undoChange(change: SeatChange) {
    setParties((current) => current.map((item) => ({
      ...item,
      seats: item.seats + (item.code === change.from ? change.seats : 0) - (item.code === change.to ? change.seats : 0),
    })));
    setChanges((current) => current.filter((item) => item.id !== change.id));
    setStatusMessage("Seat change removed.");
  }

  async function createPngBlob(): Promise<Blob> {
    const svg = svgRef.current;
    if (!svg) throw new Error("The composition preview is not ready.");
    await Promise.all([
      document.fonts.load("700 110px AvertaExport"),
      document.fonts.load("700 36px AvertaExport"),
      document.fonts.load("700 16px AvertaExport"),
    ]);
    await document.fonts.ready;
    const fontFiles = ["AvertaDemo-Regular.otf", "AvertaDemo-Semibold.otf", "AvertaDemo-Bold.otf"];
    const embeddedFonts = await Promise.all(fontFiles.map(async (filename) => {
      const response = await fetch(new URL(`/fonts/${filename}`, window.location.origin));
      if (!response.ok) throw new Error(`Could not load ${filename} for export.`);
      return arrayBufferToBase64(await response.arrayBuffer());
    }));
    const exportSvg = svg.cloneNode(true) as SVGSVGElement;
    exportSvg.setAttribute("font-family", "AvertaExport, Arial, sans-serif");
    const fontStyle = document.createElementNS("http://www.w3.org/2000/svg", "style");
    fontStyle.textContent = `@font-face{font-family:AvertaExport;src:url(data:font/otf;base64,${embeddedFonts[0]}) format('opentype');font-weight:400}@font-face{font-family:AvertaExport;src:url(data:font/otf;base64,${embeddedFonts[1]}) format('opentype');font-weight:600}@font-face{font-family:AvertaExport;src:url(data:font/otf;base64,${embeddedFonts[2]}) format('opentype');font-weight:700}`;
    exportSvg.insertBefore(fontStyle, exportSvg.firstChild);
    await Promise.all(Array.from(exportSvg.querySelectorAll("image")).map(async (graphicImage) => {
      const href = graphicImage.getAttribute("href") ?? graphicImage.getAttributeNS("http://www.w3.org/1999/xlink", "href");
      if (!href || href.startsWith("data:")) return;
      const response = await fetch(new URL(href, window.location.origin));
      if (!response.ok) throw new Error("Could not load the Ireland Votes logo for export.");
      const mimeType = response.headers.get("content-type")?.split(";")[0] || "image/png";
      const imageData = arrayBufferToBase64(await response.arrayBuffer());
      graphicImage.setAttribute("href", `data:${mimeType};base64,${imageData}`);
    }));
    const source = new XMLSerializer().serializeToString(exportSvg);
    const svgBlob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    try {
      const image = new Image();
      image.decoding = "async";
      const loaded = new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("The graphic could not be rendered."));
      });
      image.src = url;
      await loaded;
      const canvas = document.createElement("canvas");
      canvas.width = GRAPHIC_WIDTH * 2;
      canvas.height = GRAPHIC_HEIGHT * 2;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas rendering is unavailable.");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return await new Promise<Blob>((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error("PNG export failed.")), "image/png"));
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function downloadPng() {
    setExporting(true);
    setStatusMessage("");
    try {
      const png = await createPngBlob();
      const downloadUrl = URL.createObjectURL(png);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = `${slug(title)}-${slug(selected.label)}.png`;
      anchor.click();
      URL.revokeObjectURL(downloadUrl);
      setStatusMessage("PNG downloaded.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Could not export this graphic. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  const mapWinners = useMemo(() => {
    const winners = new Map((selected.constituencies ?? []).map((item) => [item.name, item.winner]));
    for (const change of changes) if (change.constituency) winners.set(change.constituency, change.to);
    return winners;
  }, [selected, changes]);
  const chamberTracks = useMemo(() => chamberSeatTracks(selected.id), [selected.id]);
  const hemicycleDots = useMemo(() => chamberSeatPositions(selected.totalSeats, chamberTracks), [selected.totalSeats, chamberTracks]);
  const seatsForDot = useMemo(() => {
    if (selected.id === "dail" || selected.id === "assembly") {
      return chamberSeatPartyAssignment(hemicycleDots, parties, selected.id, chamberTracks);
    }
    const assigned = sortedParties.flatMap((item) => Array.from({ length: Math.max(0, Math.floor(item.seats)) }, () => item));
    const vacant = parties.find((item) => item.code === "VACANT") ?? { code: "VACANT", name: "Vacant", seats: 0, color: VACANT_COLOR };
    return hemicycleDots.map((_, index) => assigned[index] ?? vacant);
  }, [selected.id, sortedParties, parties, hemicycleDots]);
  const logoHref = "/landscape.png";
  const changesSummary = changes.map((change) => change.note || `${change.kind}: ${change.from || "No outgoing party"} to ${change.to}${change.constituency ? ` · ${change.constituency}` : ""}`).join(" · ");
  const changesSummaryFontSize = Math.max(11, Math.min(15, 1740 / Math.max(1, changesSummary.length * 0.56)));
  const postText = useMemo(() => {
    const partyLines = sortedParties.filter((item) => item.seats > 0 && !isIndependentParty(item)).map((item) => {
      const delta = item.seats - (baselineByCode[item.code] ?? 0);
      return `${item.code}: ${item.seats}${delta ? ` (${delta > 0 ? "+" : ""}${delta})` : ""}`;
    });
    const unassigned = Math.max(0, selected.totalSeats - totalCurrentSeats);
    if (unassigned) partyLines.push(`Unassigned: ${unassigned}`);
    partyLines.push(...sortedParties.filter((item) => item.seats > 0 && isIndependentParty(item)).map((item) => {
      const delta = item.seats - (baselineByCode[item.code] ?? 0);
      return `${item.code}: ${item.seats}${delta ? ` (${delta > 0 ? "+" : ""}${delta})` : ""}`;
    }));
    const formattedDate = date ? new Date(`${date}T12:00:00`).toLocaleDateString("en-IE", { day: "numeric", month: "long", year: "numeric" }) : "";
    return [title, `${selected.label}${formattedDate ? ` · ${formattedDate}` : ""}`, "", ...partyLines, changesSummary ? "" : null, changesSummary ? `Changes: ${changesSummary}` : null, "", "Ireland Votes"].filter((line): line is string => line !== null).join("\n");
  }, [baselineByCode, changesSummary, date, selected.label, selected.totalSeats, sortedParties, title, totalCurrentSeats]);

  useEffect(() => {
    let active = true;
    Promise.all([
      document.fonts.load("700 110px AvertaExport"),
      document.fonts.load("700 36px AvertaExport"),
      document.fonts.load("700 16px AvertaExport"),
    ])
      .then(() => document.fonts.ready)
      .then(() => { if (active) setPreviewFontsReady(true); })
      .catch(() => { if (active) setPreviewFontsReady(true); });
    return () => { active = false; };
  }, []);
  useEffect(() => { setTweetDraft(postText); }, [postText]);
  useEffect(() => {
    if (!postOpen) return;
    let active = true;
    setXStatus((current) => ({ ...current, loading: true }));
    fetch("/api/staff/x/status", { cache: "no-store" })
      .then(async (response) => response.json() as Promise<{ configured?: boolean; connected?: boolean; username?: string }>)
      .then((data) => { if (active) setXStatus({ loading: false, configured: Boolean(data.configured), connected: Boolean(data.connected), username: data.username }); })
      .catch(() => { if (active) setXStatus({ loading: false, configured: false, connected: false }); });
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPostOpen(false);
        setPostImage("");
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => { active = false; window.removeEventListener("keydown", closeOnEscape); };
  }, [postOpen]);

  useEffect(() => () => { if (postImage) URL.revokeObjectURL(postImage); }, [postImage]);

  async function openPost() {
    setPreparingPost(true);
    setPostError("");
    setPostedUrl("");
    setCopyStatus("");
    try {
      const png = await createPngBlob();
      setPostImage(URL.createObjectURL(png));
      setPostOpen(true);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Could not prepare the post preview.");
    } finally {
      setPreparingPost(false);
    }
  }

  function closePost() {
    setPostOpen(false);
    setPostImage("");
  }

  async function copyPost() {
    try { await navigator.clipboard.writeText(tweetDraft); setCopyStatus("Copied"); }
    catch { setCopyStatus("Copy failed"); }
  }

  async function publishPost() {
    setPublishing(true);
    setPostError("");
    try {
      if (!postImage) throw new Error("Prepare the graphic preview first.");
      const graphic = await fetch(postImage).then((response) => response.blob());
      const form = new FormData();
      form.set("text", tweetDraft);
      form.set("graphic", graphic, `${slug(title)}-${slug(selected.label)}.png`);
      const response = await fetch("/api/staff/x/post", { method: "POST", body: form });
      const result = await response.json() as { error?: string; postUrl?: string; posted?: boolean };
      if (!response.ok || !result.posted || !result.postUrl) throw new Error(result.error ?? "X could not publish this post.");
      setPostedUrl(result.postUrl);
    } catch (error) {
      setPostError(error instanceof Error ? error.message : "X could not publish this post.");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <main className="composition-workspace">
      <section className="composition-toolbar" aria-label="Composition graphic controls">
        <div className="composition-toolbar-heading"><p className="staff-eyebrow">IRELAND VOTES / CONTENT STUDIO</p><h1>Parliament composition</h1><p>Show the balance of seats, with changes in party affiliation and representation reflected in the graphic.</p></div>
        <div className="composition-toolbar-actions">
          <label>Chamber<select value={templateId} onChange={(event) => selectTemplate(event.target.value as CompositionTemplate["id"])}>{templates.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <button className="staff-generate-post-button" type="button" onClick={() => { void openPost(); }} disabled={preparingPost || exporting}>{preparingPost ? "Preparing post…" : "Generate post"}</button>
          <button className="composition-export-button" type="button" onClick={downloadPng} disabled={exporting}>{exporting ? "Preparing PNG…" : "↓ Download PNG"}</button>
        </div>
      </section>

      <section className="composition-editor-grid">
        <div className="composition-editor-panel">
          <div className="composition-panel-heading"><div><p className="composition-panel-kicker">01 / GRAPHIC</p><h2>Set the frame</h2></div><span>{selected.totalSeats} seats</span></div>
          <div className="composition-field-grid">
            <label className="composition-field composition-field-wide">Headline<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={70} /></label>
            <label className="composition-field">Composition date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
            <div className="composition-field composition-field-source"><span>Starting point</span><strong>{selected.sourceLabel}</strong><small>Edit any total below to reflect the latest position.</small></div>
          </div>
          <div className="composition-panel-heading composition-party-heading"><div><p className="composition-panel-kicker">02 / PARTY TOTALS</p><h2>Order and colour</h2></div><span>{totalCurrentSeats} / {selected.totalSeats} seats</span></div>
          <div className="composition-party-list" role="list" aria-label="Party seat counts">
            {sortedParties.map((item) => {
              const baseline = baselineByCode[item.code] ?? 0;
              const delta = item.seats - baseline;
              return <div className="composition-party-editor-row" key={item.code}>
                <input className="composition-color-input" type="color" aria-label={`${item.code} colour`} value={item.color.startsWith("#") ? item.color : "#788589"} onChange={(event) => updateParty(item.code, { color: event.target.value })} />
                <label className="composition-party-name"><span>{item.code}</span><input value={item.name} aria-label={`${item.code} display name`} onChange={(event) => updateParty(item.code, { name: event.target.value })} /></label>
                <input className="composition-party-seats" type="number" min="0" max={selected.totalSeats} value={item.seats} aria-label={`${item.code} seats`} onChange={(event) => updateParty(item.code, { seats: Math.max(0, Math.floor(Number(event.target.value) || 0)) })} />
                <span className={`composition-party-delta ${delta > 0 ? "positive" : delta < 0 ? "negative" : ""}`}>{delta > 0 ? `+${delta}` : delta || "—"}</span>
                <button className="composition-remove-party" type="button" aria-label={`Remove ${item.code}`} title="Remove party" onClick={() => { setParties((current) => current.filter((partyItem) => partyItem.code !== item.code)); if (fromParty === item.code) setFromParty(""); if (toParty === item.code) setToParty(""); }}>×</button>
              </div>;
            })}
          </div>
          <form className="composition-add-party" onSubmit={(event) => { event.preventDefault(); addParty(); }}>
            <input value={partyCode} onChange={(event) => setPartyCode(event.target.value)} placeholder="Code" aria-label="New party abbreviation" maxLength={8} />
            <input value={partyName} onChange={(event) => setPartyName(event.target.value)} placeholder="Add a party or group" aria-label="New party name" />
            <input type="color" value={partyColor} aria-label="New party colour" onChange={(event) => setPartyColor(event.target.value)} />
            <button type="submit">+ Add</button>
          </form>

          <div className="composition-panel-heading composition-changes-heading"><div><p className="composition-panel-kicker">03 / CHANGES</p><h2>Record seat changes</h2></div><span>{changes.length} added</span></div>
          <form className="composition-change-form" onSubmit={applyChange}>
            <label>Change type<select value={changeKind} onChange={(event) => setChangeKind(event.target.value as ChangeKind)}><option>By-election</option><option>Affiliation change</option><option>Custom adjustment</option></select></label>
            <label>From<select value={fromParty} onChange={(event) => setFromParty(event.target.value)}><option value="">No outgoing party</option>{sortedParties.map((item) => <option key={item.code} value={item.code}>{item.code} · {item.name}</option>)}</select></label>
            <label>To<select value={toParty} onChange={(event) => setToParty(event.target.value)}>{sortedParties.map((item) => <option key={item.code} value={item.code}>{item.code} · {item.name}</option>)}</select></label>
            <label>Seats<input type="number" min="1" max={selected.totalSeats} value={changeSeats} onChange={(event) => setChangeSeats(event.target.value)} /></label>
            {selected.mode === "map" && <label className="composition-field-wide">Constituency<select value={changeConstituency} onChange={(event) => setChangeConstituency(event.target.value)}><option value="">No map location</option>{(selected.constituencies ?? []).map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select></label>}
            <label className="composition-field-wide">Change note<input value={changeNote} onChange={(event) => setChangeNote(event.target.value)} placeholder="Optional note for the graphic (e.g. by-election result)" /></label>
            <button className="composition-apply-change" type="submit">Apply seat change <span aria-hidden="true">→</span></button>
          </form>
          {changes.length > 0 && <ol className="composition-change-log">{[...changes].reverse().map((change) => <li key={change.id}><div><strong>{change.kind}</strong><span>{change.from || "—"} → {change.to} · {change.seats} seat{change.seats === 1 ? "" : "s"}{change.constituency ? ` · ${change.constituency}` : ""}</span>{change.note && <small>{change.note}</small>}</div><button type="button" onClick={() => undoChange(change)} aria-label="Undo seat change">Undo</button></li>)}</ol>}
          {statusMessage && <p role="status" className="composition-status-message">{statusMessage}</p>}
        </div>

        <div className="composition-preview-panel">
          <div className="composition-preview-topline"><div><span>LIVE PREVIEW</span><span>16:9 SOCIAL GRAPHIC</span></div><span className={seatDifference === 0 ? "composition-total-ok" : "composition-total-warning"}>{seatDifference === 0 ? "TOTALS BALANCED" : `${seatDifference > 0 ? "+" : ""}${seatDifference} FROM CHAMBER TOTAL`}</span></div>
          <div className="composition-canvas-wrap">
            <svg ref={svgRef} className="composition-svg" style={{ visibility: previewFontsReady ? "visible" : "hidden" }} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${GRAPHIC_WIDTH} ${GRAPHIC_HEIGHT}`} role="img" aria-label={`${title}, ${totalCurrentSeats} seats`} letterSpacing="-0.0276em">
              <defs>
                <linearGradient id="composition-header-gradient" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#11191b" /><stop offset=".64" stopColor="#15343a" /><stop offset="1" stopColor="#075e68" /></linearGradient>
                <linearGradient id="composition-cyan-rule" x1="0" x2="1"><stop offset="0" stopColor="#00d7e6" /><stop offset="1" stopColor="#00a9b5" /></linearGradient>
                <radialGradient id="composition-content-glow" cx="50%" cy="48%" r="52%"><stop offset="0" stopColor="#bcebed" stopOpacity=".72" /><stop offset=".58" stopColor="#d9f2f3" stopOpacity=".42" /><stop offset="1" stopColor="#f2f6f6" stopOpacity="0" /></radialGradient>
                <clipPath id="composition-content-clip"><rect y="160" width={GRAPHIC_WIDTH} height={GRAPHIC_HEIGHT - 160} /></clipPath>
              </defs>
              <rect width={GRAPHIC_WIDTH} height={GRAPHIC_HEIGHT} fill="#f2f6f6" />
              <rect width={GRAPHIC_WIDTH} height="160" fill="url(#composition-header-gradient)" />
              <rect width={GRAPHIC_WIDTH} height="8" fill="url(#composition-cyan-rule)" />
              <ellipse cx="1330" cy="560" rx="500" ry="505" fill="url(#composition-content-glow)" clipPath="url(#composition-content-clip)" />
              <text x="72" y={80 + titleFontSize * 0.33} fill="#ffffff" fontSize={titleFontSize} fontWeight="700" letterSpacing="-3.036">{title}</text>
              <image href={logoHref} x="1502" y="18" width="348" height="120" preserveAspectRatio="xMaxYMid meet" />

              <g transform={`translate(0 ${selected.id === "hoc" ? 0 : -40}) translate(29 0) translate(428 575) scale(1.1) translate(-428 -575)`}>
              {sortedParties.map((item, index) => {
                const step = partyRowStep;
                const y = partyListStartY + index * step;
                const barHeight = partyRowBarHeight;
                return <g key={`${item.code}-background`}>
                  <rect x="78" y={y} width="700" height={barHeight + 4} rx="8" fill={item.color} opacity=".14" />
                  <path d={`M578 ${y} H770 Q778 ${y} 778 ${y + 8} V${y + barHeight - 4} Q778 ${y + barHeight + 4} 770 ${y + barHeight + 4} H578 Z`} fill={item.color} />
                </g>;
              })}
              {sortedParties.map((item, index) => {
                const step = partyRowStep;
                const y = partyListStartY + index * step;
                const barHeight = partyRowBarHeight;
                const rowTextSize = Math.max(18, Math.min(36, barHeight * 0.62));
                const seatTextSize = Math.max(56, Math.min(110, barHeight * 1.7));
                const rowCenterY = y + (barHeight + 4) / 2;
                const numberCenterY = rowCenterY - 5;
                const seatDelta = item.seats - (baselineByCode[item.code] ?? 0);
                const deltaIconCenterX = 743;
                const deltaCenterY = y + barHeight - 12;
                const deltaArrowPath = seatDelta > 0
                  ? `M${deltaIconCenterX} ${deltaCenterY - 7} L${deltaIconCenterX + 7} ${deltaCenterY} H${deltaIconCenterX + 3} V${deltaCenterY + 6} H${deltaIconCenterX - 3} V${deltaCenterY} H${deltaIconCenterX - 7} Z`
                  : `M${deltaIconCenterX} ${deltaCenterY + 7} L${deltaIconCenterX + 7} ${deltaCenterY} H${deltaIconCenterX + 3} V${deltaCenterY - 6} H${deltaIconCenterX - 3} V${deltaCenterY} H${deltaIconCenterX - 7} Z`;
                const displayName = item.code === "UUP" ? "Ulster Unionist" : item.code === "DUP" ? "Democratic Unionist" : item.code === "TUV" ? "Traditional Unionist Voice" : item.code === "SDLP" ? "Social Democratic & Labour" : item.name;
                return <g key={item.code}>
                  <text x="98" y={rowCenterY} fill={item.color} fontSize={rowTextSize} fontWeight="700" textAnchor="start" dominantBaseline="central" letterSpacing="-1.2144">{displayName}</text>
                  <text x="635" y={numberCenterY} fill="#f2f6f6" fontSize={seatTextSize} fontWeight="700" textAnchor="middle" dominantBaseline="central">{item.seats}</text>
                  {seatDelta !== 0 && <g>
                    <circle cx={deltaIconCenterX} cy={deltaCenterY} r="10" fill="#ffffff" stroke={item.color} strokeWidth="1.5" />
                    <path d={deltaArrowPath} fill={item.color} />
                    <text x="757" y={deltaCenterY} fill="#ffffff" fontSize="16" fontWeight="700" textAnchor="start" dominantBaseline="central">{Math.abs(seatDelta)}</text>
                  </g>}
                </g>;
              })}
              </g>
              <g clipPath="url(#composition-content-clip)"><g transform="translate(29 0) translate(1260 575) scale(1.1) translate(-1260 -575)">
              {selected.mode === "map" ? <g transform="translate(984 130) scale(1.65)">
                <g transform="translate(210 260) scale(1.15) translate(-210 -260)">
                {(selected.mapFeatures ?? []).map((feature) => {
                  const code = mapWinners.get(feature.name) ?? "";
                  const color = parties.find((item) => item.code === code)?.color ?? VACANT_COLOR;
                  return <path key={feature.name} d={feature.path} fill={color} stroke="#ffffff" strokeWidth="1.4"><title>{feature.name}: {code || "No party"}</title></path>;
                })}
                </g>
              </g> : <g>
                {selected.id === "dail" && <g transform="translate(0 136.36)"><g transform="rotate(-45 1516 620)"><g transform="translate(1260 620) scale(1.83) translate(-1260 -620)">
                  {hemicycleDots.map((dot, index) => <circle key={`${index}-${seatsForDot[index]?.code}`} cx={dot.x} cy={dot.y} r="17.2" fill={lightPartyColor(seatsForDot[index]?.color ?? VACANT_COLOR)}><title>{seatsForDot[index]?.name ?? "Vacant"}</title></circle>)}
                </g></g></g>}
                {selected.id === "assembly" && <g transform="translate(124.7 81.9)"><g transform="translate(1400 575) rotate(-45) scale(1.254) translate(-1400 -575)">
                  {hemicycleDots.map((dot, index) => <circle key={`${index}-${seatsForDot[index]?.code}`} cx={dot.x} cy={dot.y} r="27.6" fill={lightPartyColor(seatsForDot[index]?.color ?? VACANT_COLOR)}><title>{seatsForDot[index]?.name ?? "Vacant"}</title></circle>)}
                </g></g>}
                {selected.id !== "dail" && selected.id !== "assembly" && <g>
                <g fill="none" stroke="#a9d6d8" strokeWidth="2" opacity=".44">
                  {chamberTracks.filter((_, index) => index % 2 === 0).map((track, index) => <path key={index} d={pathData(track)} />)}
                </g>
                {hemicycleDots.map((dot, index) => <circle key={`${index}-${seatsForDot[index]?.code}`} cx={dot.x} cy={dot.y} r="13.2" fill={seatsForDot[index]?.color ?? VACANT_COLOR}><title>{seatsForDot[index]?.name ?? "Vacant"}</title></circle>)}
                </g>}
              </g>}
              </g>
              </g>
              {changesSummary && <text x="72" y="995" fill="#526367" fontSize={changesSummaryFontSize}><tspan fontWeight="700">Changes:</tspan><tspan dx="9">{changesSummary}</tspan></text>}
              <text x="72" y="1030" fill="#292d2e" fontFamily="AvertaExport,Arial,sans-serif" fontSize="15" fontWeight="700" letterSpacing="-0.0276em">irelandvotes.com</text>
            </svg>
          </div>
          <div className="composition-preview-footer"><div><strong>{totalCurrentSeats}</strong><span>seats assigned</span><i /></div><div><strong>{changes.length}</strong><span>recorded changes</span><i /></div><p>Export opens at 3840 × 2160 for high-resolution social sharing.</p></div>
        </div>
      </section>
      {postOpen && <div className="staff-post-drawer-layer">
        <button type="button" className="staff-post-drawer-backdrop" aria-label="Close post generator" onClick={closePost} />
        <aside className="staff-post-drawer" role="dialog" aria-modal="true" aria-labelledby="composition-post-title">
          <header className="staff-post-drawer-header"><div><p className="staff-eyebrow">SOCIAL MEDIA</p><h2 id="composition-post-title">Generate post</h2></div><button type="button" className="staff-post-drawer-close" onClick={closePost}>Close</button></header>
          <div className="staff-post-drawer-content">
            <div className="staff-post-platform"><span className="staff-post-platform-icon">X</span><div><strong>Twitter / X</strong><span>Parliament composition</span></div></div>
            <div className={`staff-x-connection${xStatus.connected ? " is-connected" : ""}`}>{xStatus.loading ? <span>Checking X connection…</span> : xStatus.connected ? <span><strong>Connected</strong> as @{xStatus.username}</span> : xStatus.configured ? <><span>Connect the Ireland Votes account to publish.</span><a href="/api/staff/x/connect">Connect X account</a></> : <span>X publishing is not configured on this server.</span>}</div>
            <label className="staff-post-copy-label" htmlFor="composition-post-copy">Post text <span>{Array.from(tweetDraft).length} characters</span></label>
            <textarea id="composition-post-copy" className="staff-tweet-draft" value={tweetDraft} onChange={(event) => setTweetDraft(event.target.value)} />
            <article className="staff-x-post-preview"><div className="staff-x-post-author"><span className="staff-x-post-avatar">IV</span><span><strong>Ireland Votes</strong><small>Polling &amp; electoral analysis</small></span><b>X</b></div><p className="staff-x-post-text">{tweetDraft}</p>{postImage && <img className="staff-x-post-image" src={postImage} alt={`${selected.label} composition graphic attached to post`} />}</article>
            {postError && <p className="staff-post-error" role="alert">{postError}</p>}
            {postedUrl && <p className="staff-post-success" role="status">Published. <a href={postedUrl} target="_blank" rel="noreferrer">View post on X</a></p>}
          </div>
          <footer className="staff-post-drawer-footer"><span className="staff-post-copy-status">{copyStatus}</span><button type="button" className="staff-copy-tweet-button" onClick={() => { void copyPost(); }}>Copy post</button><button type="button" className="staff-post-now-button" disabled={!xStatus.connected || xStatus.loading || publishing || Boolean(postedUrl)} onClick={() => { void publishPost(); }}>{publishing ? "Publishing…" : postedUrl ? "Published" : "Post to X"}</button></footer>
        </aside>
      </div>}
    </main>
  );
}
