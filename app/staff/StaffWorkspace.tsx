"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import {
  DEFAULT_POLLING_PARTY_CODES,
  PARTY_BY_CODE,
  PARTY_CATALOG,
  type ElectionComparison,
  type PartyDefinition,
  type PollingGraphicOptions,
} from "@/lib/staff/pollingGraphicCatalog";

type PartyResult = { code: string; poll: number };
type AddableSource = "pollster" | "commissioner";
type XConnectionStatus = { loading: boolean; configured: boolean; connected: boolean; username?: string };
const SOURCE_STORAGE_KEY = "iv-staff-polling-graphic-sources";
const PARTY_STORAGE_KEY = "iv-staff-polling-graphic-parties";
const DAIL_TWEET_ORDER = ["SF", "FF", "FG", "SD", "AON", "INDIRL", "LAB", "PBPS", "GP", "IND"];
const ENGLISH_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const IRISH_MONTHS = ["Eanáir", "Feabhra", "Márta", "Aibreán", "Bealtaine", "Meitheamh", "Iúil", "Lúnasa", "Meán Fómhair", "Deireadh Fómhair", "Samhain", "Nollaig"];

const INITIAL_POLL_VALUES: Record<string, number> = {
  FF: 18,
  FG: 18,
  SF: 19,
  SD: 11,
  LAB: 4,
  AON: 8,
  INDIRL: 5,
  GP: 3,
  PBPS: 2,
};

const WIDTH = 2048;
const HEIGHT = 1024;
const BASELINE = 904;
const COMPARISON_TEMPLATES = [
  { id: "ireland/dail/2024", label: "Dáil Éireann", year: "2024", partyCodes: DEFAULT_POLLING_PARTY_CODES },
  {
    id: "northern-ireland/assembly/2022",
    label: "NI Assembly",
    year: "2022",
    partyCodes: ["SF", "DUP", "AP", "UUP", "SDLP", "TUV", "GP", "AON", "PBP"],
  },
  {
    id: "northern-ireland/house-of-commons/2024",
    label: "House of Commons · NI",
    year: "2024",
    partyCodes: ["SF", "DUP", "AP", "UUP", "SDLP", "TUV", "GP", "PBP", "AON"],
  },
];
const COMPARISON_TEMPLATE_DETAILS: Record<string, {
  heading: string;
  pollDataset: "dail" | "niAssembly";
  electionDate: string;
  sourceNote?: string;
}> = {
  "ireland/dail/2024": { heading: "Dáil Éireann", pollDataset: "dail", electionDate: "2024-11-29" },
  "northern-ireland/assembly/2022": { heading: "NI Assembly", pollDataset: "niAssembly", electionDate: "2022-05-05" },
  "northern-ireland/house-of-commons/2024": {
    heading: "House of Commons (NI)",
    pollDataset: "niAssembly",
    electionDate: "2024-07-04",
    sourceNote: "Uses the latest NI Assembly poll; a separate Westminster poll dataset is not available yet.",
  },
};

function lighten(hex: string, amount = 0.65) {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  const mix = (channel: number) => Math.round(channel + (255 - channel) * amount);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

function formatGraphicDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  const englishMonths = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const irishMonths = ["Eanáir", "Feabhra", "Márta", "Aibreán", "Bealtaine", "Meitheamh", "Iúil", "Lúnasa", "Meán Fómhair", "Deireadh Fómhair", "Samhain", "Nollaig"];
  return `${day} ${irishMonths[month - 1]} / ${englishMonths[month - 1]} ${year}`;
}

function dateParts(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return year && month && day ? { year, month, day } : null;
}

function formatGraphicDateRange(start: string, end: string) {
  const first = dateParts(start);
  const last = dateParts(end);
  if (!first || !last) return formatGraphicDate(end || start);
  if (first.year === last.year && first.month === last.month) {
    const dateLabel = first.day === last.day ? `${last.day}` : `${first.day}-${last.day}`;
    return `${dateLabel} ${IRISH_MONTHS[last.month - 1]}/${ENGLISH_MONTHS[last.month - 1]} ${last.year}`;
  }
  return `${formatGraphicDate(start)} – ${formatGraphicDate(end)}`;
}

function formatComparisonMonth(value: string) {
  const parts = dateParts(value);
  return parts ? `${IRISH_MONTHS[parts.month - 1]}/${ENGLISH_MONTHS[parts.month - 1]} ${parts.year}` : "";
}

function formatPollNumber(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function ensureSelectedOption(values: string[], selected: string) {
  return selected && !values.some((value) => value.toLowerCase() === selected.toLowerCase())
    ? [selected, ...values]
    : values;
}

function mergeSourceNames(...groups: unknown[][]) {
  const names = new Map<string, string>();
  groups.flat().forEach((value) => {
    if (typeof value !== "string") return;
    const clean = value.trim();
    if (clean) names.set(clean.toLowerCase(), clean);
  });
  return [...names.values()].sort((a, b) => a.localeCompare(b));
}

export default function StaffWorkspace({ options }: { options: PollingGraphicOptions }) {
  const previewRef = useRef<SVGSVGElement>(null);
  const defaultComparison = options.elections.find((election) => election.id === "ireland/dail/2024")
    ?? options.elections[0];
  const defaultTemplate = COMPARISON_TEMPLATES.find((template) => template.id === defaultComparison?.id);
  const defaultTemplateDetails = COMPARISON_TEMPLATE_DETAILS[defaultComparison?.id ?? ""];
  const initialPoll = defaultTemplateDetails ? options.latestPolls[defaultTemplateDetails.pollDataset] : null;
  const initialPartyCodes = defaultTemplate?.partyCodes ?? DEFAULT_POLLING_PARTY_CODES;

  const [title, setTitle] = useState(COMPARISON_TEMPLATE_DETAILS[defaultComparison?.id ?? ""]?.heading ?? "Dáil Éireann");
  const [pollster, setPollster] = useState(initialPoll?.pollster || "Ireland Thinks");
  const [commissioner, setCommissioner] = useState(initialPoll?.commissioner || "The Sunday Independent");
  const [fieldworkStartDate, setFieldworkStartDate] = useState(initialPoll?.date ?? "2026-10-04");
  const [fieldworkDate, setFieldworkDate] = useState(initialPoll?.date ?? "2026-10-04");
  const [sampleSize, setSampleSize] = useState(initialPoll?.sample ? String(initialPoll.sample) : "");
  const [pollsters, setPollsters] = useState(() => ensureSelectedOption(options.pollsters, initialPoll?.pollster ?? "Ireland Thinks"));
  const [commissioners, setCommissioners] = useState(() => ensureSelectedOption(options.commissioners, initialPoll?.commissioner ?? "The Sunday Independent"));
  const [comparisonId, setComparisonId] = useState(defaultComparison?.id ?? "");
  const [parties, setParties] = useState<PartyResult[]>(
    initialPartyCodes.map((code) => ({ code, poll: initialPoll?.partyShares[code] ?? INITIAL_POLL_VALUES[code] ?? 0 })),
  );
  const partyPollCache = useRef<Record<string, number>>({ ...INITIAL_POLL_VALUES, ...(initialPoll?.partyShares ?? {}) });
  const [partyCatalog, setPartyCatalog] = useState<PartyDefinition[]>(PARTY_CATALOG);
  const [addingSource, setAddingSource] = useState<AddableSource | null>(null);
  const [newSourceName, setNewSourceName] = useState("");
  const [addingPartyFor, setAddingPartyFor] = useState<number | null>(null);
  const [showNewPartyForm, setShowNewPartyForm] = useState(false);
  const [newPartyCode, setNewPartyCode] = useState("");
  const [newPartyName, setNewPartyName] = useState("");
  const [newPartyAffiliation, setNewPartyAffiliation] = useState("");
  const [newPartyError, setNewPartyError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [tweetCopyStatus, setTweetCopyStatus] = useState("");
  const [tweetDraft, setTweetDraft] = useState("");
  const [postPanelOpen, setPostPanelOpen] = useState(false);
  const [graphicPreviewUrl, setGraphicPreviewUrl] = useState("");
  const [xConnection, setXConnection] = useState<XConnectionStatus>({ loading: false, configured: false, connected: false });
  const [xPublishing, setXPublishing] = useState(false);
  const [xPublishError, setXPublishError] = useState("");
  const [publishedPostUrl, setPublishedPostUrl] = useState("");
  const [mobilePanel, setMobilePanel] = useState<"edit" | "preview">("edit");

  useEffect(() => {
    try {
      const savedSources = JSON.parse(window.localStorage.getItem(SOURCE_STORAGE_KEY) ?? "{}") as Record<string, unknown>;
      if (Array.isArray(savedSources.pollsters)) {
        setPollsters((current) => mergeSourceNames(current, savedSources.pollsters as unknown[]));
      }
      if (Array.isArray(savedSources.commissioners)) {
        setCommissioners((current) => mergeSourceNames(current, savedSources.commissioners as unknown[]));
      }

      const savedParties = JSON.parse(window.localStorage.getItem(PARTY_STORAGE_KEY) ?? "[]") as unknown;
      if (Array.isArray(savedParties)) {
        const customParties = savedParties.filter((item): item is PartyDefinition =>
          Boolean(item && typeof item === "object" &&
            typeof (item as PartyDefinition).code === "string" &&
            typeof (item as PartyDefinition).name === "string" &&
            typeof (item as PartyDefinition).color === "string" &&
            typeof (item as PartyDefinition).affiliation === "string" &&
            !PARTY_BY_CODE[(item as PartyDefinition).code]),
        );
        setPartyCatalog((current) => [...current, ...customParties.filter((item) => !current.some((party) => party.code === item.code))]);
      }
    } catch {
      // Ignore malformed local preferences and keep the built-in source lists.
    }
  }, []);

  const comparisonElection = options.elections.find((election) => election.id === comparisonId);
  const activeTemplate = COMPARISON_TEMPLATES.find((template) => template.id === comparisonId);
  const activeTemplateDetails = COMPARISON_TEMPLATE_DETAILS[comparisonId];
  const activePoll = activeTemplateDetails ? options.latestPolls[activeTemplateDetails.pollDataset] : null;
  const matchingPriorPoll = activePoll && activeTemplateDetails && pollster.trim() && commissioner.trim()
    ? activePoll.history
      .filter((record) =>
        record.date > activeTemplateDetails.electionDate &&
        record.date < fieldworkDate &&
        record.pollster.trim().toLocaleLowerCase() === pollster.trim().toLocaleLowerCase() &&
        record.commissioner.trim().toLocaleLowerCase() === commissioner.trim().toLocaleLowerCase(),
      )
      .sort((a, b) => b.date.localeCompare(a.date))[0]
    : undefined;
  const comparisonShares = matchingPriorPoll?.partyShares ?? comparisonElection?.partyShares ?? {};
  const comparisonPeriod = matchingPriorPoll
    ? formatComparisonMonth(matchingPriorPoll.date)
    : comparisonElection ? `${comparisonElection.label} election result` : "";
  const availableComparisonTemplates = COMPARISON_TEMPLATES.filter((template) =>
    options.elections.some((election) => election.id === template.id),
  );

  function selectComparison(id: string) {
    setComparisonId(id);
    const template = COMPARISON_TEMPLATES.find((item) => item.id === id);
    if (!template) return;
    const details = COMPARISON_TEMPLATE_DETAILS[id];
    const latestPoll = details ? options.latestPolls[details.pollDataset] : null;
    if (details) setTitle(details.heading);
    if (latestPoll) {
      if (latestPoll.pollster) setPollster(latestPoll.pollster);
      if (latestPoll.commissioner) setCommissioner(latestPoll.commissioner);
      setFieldworkStartDate(latestPoll.date);
      setFieldworkDate(latestPoll.date);
      setSampleSize(latestPoll.sample ? String(latestPoll.sample) : "");
    }

    setParties((current) => {
      current.forEach(({ code, poll }) => { partyPollCache.current[code] = poll; });
      return template.partyCodes.map((code) => ({
        code,
        poll: latestPoll ? latestPoll.partyShares[code] ?? 0 : partyPollCache.current[code] ?? 0,
      }));
    });
  }
  const graphicDate = formatGraphicDateRange(fieldworkStartDate, fieldworkDate);
  const sourceLine = [pollster, commissioner].filter(Boolean).join(" & ");
  const tweetPartyValues = { ...(activePoll?.partyShares ?? {}) };
  parties.forEach((party) => { tweetPartyValues[party.code] = party.poll; });
  const preferredTweetOrder = comparisonId === "ireland/dail/2024"
    ? DAIL_TWEET_ORDER
    : activeTemplate?.partyCodes ?? parties.map((party) => party.code);
  const tweetPartyOrder = [...preferredTweetOrder, ...parties.map((party) => party.code).filter((code) => !preferredTweetOrder.includes(code))];
  const tweetPartyLines = tweetPartyOrder.flatMap((code) => {
    const value = tweetPartyValues[code];
    if (value === undefined || value <= 0) return [];
    const previous = comparisonShares[code];
    const change = previous === undefined ? 0 : Math.round((value - previous) * 10) / 10;
    const changeText = change === 0 ? "" : ` (${change > 0 ? "+" : ""}${formatPollNumber(change)})`;
    return [`${code === "IND" ? "INDs" : code}: ${formatPollNumber(value)}%${changeText}`];
  });
  const enteredSampleSize = Number(sampleSize);
  const roundedSample = Number.isFinite(enteredSampleSize) && enteredSampleSize > 0
    ? Math.round(enteredSampleSize / 100) * 100
    : null;
  const sampleLine = roundedSample ? `S: ~${roundedSample.toLocaleString("en-IE")}` : "";
  const tweetText = [
    `POLL / POBALBHREITH - ${title}`,
    "",
    ...tweetPartyLines,
    "",
    comparisonPeriod ? `+/- vs. ${comparisonPeriod}` : "",
    "",
    pollster ? `via ${pollster}` : "",
    `D: ${graphicDate}`,
    sampleLine,
    "",
    "#Ireland #Poll",
  ].filter((line, index, allLines) => line !== "" || (index > 0 && allLines[index - 1] !== "")).join("\n");
  const tweetCharacterCount = Array.from(tweetDraft).length;
  useEffect(() => {
    setTweetDraft(tweetText);
    setTweetCopyStatus("");
  }, [tweetText]);
  useEffect(() => {
    if (!postPanelOpen) return;
    let active = true;
    setXConnection((current) => ({ ...current, loading: true }));
    fetch("/api/staff/x/status", { cache: "no-store" })
      .then(async (response) => ({ response, data: await response.json() as { configured?: boolean; connected?: boolean; username?: string } }))
      .then(({ data }) => {
        if (active) setXConnection({ loading: false, configured: Boolean(data.configured), connected: Boolean(data.connected), username: data.username });
      })
      .catch(() => {
        if (active) setXConnection({ loading: false, configured: false, connected: false });
      });
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPostPanelOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      active = false;
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [postPanelOpen]);
  useEffect(() => () => {
    if (graphicPreviewUrl) URL.revokeObjectURL(graphicPreviewUrl);
  }, [graphicPreviewUrl]);
  const subtitle = `First Preference Voting Intention${sourceLine ? ` · Via ${sourceLine}` : ""}${graphicDate ? ` · ${graphicDate}` : ""}`;
  const largestValue = Math.max(
    1,
    ...parties.flatMap((party) => [
      party.poll,
      comparisonElection?.partyShares[party.code] ?? 0,
    ]),
  );
  const barScale = Math.min(26, 565 / largestValue);

  function updatePollValue(index: number, poll: number) {
    setParties((current) => current.map((party, i) => {
      if (i !== index) return party;
      partyPollCache.current[party.code] = poll;
      return { ...party, poll };
    }));
  }

  function updatePartyCode(index: number, code: string) {
    if (code === "__add_party__") {
      setAddingPartyFor(index);
      setShowNewPartyForm(true);
      setNewPartyError("");
      return;
    }
    setParties((current) => current.map((party, i) => {
      if (i !== index) return party;
      partyPollCache.current[code] = party.poll;
      return { ...party, code };
    }));
  }

  async function copyTweetText() {
    try {
      await navigator.clipboard.writeText(tweetDraft);
      setTweetCopyStatus("Copied to clipboard");
    } catch {
      setTweetCopyStatus("Copy failed — select and copy the text above");
    }
  }

  async function openSocialPost() {
    setTweetCopyStatus("");
    setXPublishError("");
    setPublishedPostUrl("");
    const graphic = previewRef.current?.cloneNode(true) as SVGSVGElement | undefined;
    if (graphic) {
      try {
        const loadAssetData = async (path: string, mimeType: string) => {
          const response = await fetch(path);
          if (!response.ok) throw new Error("Could not load a preview asset.");
          const bytes = new Uint8Array(await response.arrayBuffer());
          let binary = "";
          for (let offset = 0; offset < bytes.length; offset += 0x8000) {
            binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
          }
          return `data:${mimeType};base64,${btoa(binary)}`;
        };
        const [avertaRegular, avertaSemibold, avertaBold, logoDataUrl] = await Promise.all([
          loadAssetData("/fonts/AvertaDemo-Regular.otf", "font/otf"),
          loadAssetData("/fonts/AvertaDemo-Semibold.otf", "font/otf"),
          loadAssetData("/fonts/AvertaDemo-Bold.otf", "font/otf"),
          loadAssetData("/portrait.png", "image/png"),
        ]);
        graphic.querySelectorAll("image").forEach((image) => image.setAttribute("href", logoDataUrl));
        const fontStyle = document.createElementNS("http://www.w3.org/2000/svg", "style");
        fontStyle.textContent = `@font-face{font-family:AvertaExport;src:url('${avertaRegular}') format('opentype');font-weight:400}@font-face{font-family:AvertaExport;src:url('${avertaSemibold}') format('opentype');font-weight:600}@font-face{font-family:AvertaExport;src:url('${avertaBold}') format('opentype');font-weight:700}`;
        graphic.insertBefore(fontStyle, graphic.firstChild);
      } catch {
        // The post can still be prepared if the thumbnail logo cannot be embedded.
      }
      graphic.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      const previewUrl = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(graphic)], { type: "image/svg+xml;charset=utf-8" }));
      setGraphicPreviewUrl(previewUrl);
    }
    setPostPanelOpen(true);
  }

  async function createPostGraphicBlob() {
    if (!graphicPreviewUrl) throw new Error("Generate a post preview before publishing.");
    const image = new Image();
    image.src = graphicPreviewUrl;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 4000;
    canvas.height = 2000;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("PNG export is unavailable in this browser.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("The polling graphic could not be rendered as a PNG.");
    return blob;
  }

  async function publishToX() {
    setXPublishing(true);
    setXPublishError("");
    setPublishedPostUrl("");
    try {
      const graphic = await createPostGraphicBlob();
      const form = new FormData();
      form.set("text", tweetDraft);
      form.set("graphic", graphic, "ireland-votes-poll.png");
      const response = await fetch("/api/staff/x/post", { method: "POST", body: form });
      const result = await response.json() as { error?: string; postUrl?: string; posted?: boolean };
      if (!response.ok || !result.posted || !result.postUrl) {
        throw new Error(result.error ?? "X could not publish the post.");
      }
      setPublishedPostUrl(result.postUrl);
    } catch (error) {
      setXPublishError(error instanceof Error ? error.message : "X could not publish the post.");
    } finally {
      setXPublishing(false);
    }
  }

  async function disconnectX() {
    try {
      const response = await fetch("/api/staff/x/status", { method: "DELETE" });
      if (response.ok) setXConnection({ loading: false, configured: true, connected: false });
    } catch {
      setXPublishError("The X account could not be disconnected.");
    }
  }

  function addPartyRow() {
    const nextAvailable = partyCatalog.find((item) => !parties.some((party) => party.code === item.code));
    if (nextAvailable) {
      setParties((current) => [...current, { code: nextAvailable.code, poll: 0 }]);
      return;
    }
    setAddingPartyFor(null);
    setShowNewPartyForm(true);
    setNewPartyError("");
  }

  function saveNewParty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = newPartyCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    const name = newPartyName.trim();

    if (!code || !name) {
      setNewPartyError("Enter both the party name and its acronym.");
      return;
    }

    if (parties.some((party, index) => party.code === code && index !== addingPartyFor)) {
      setNewPartyError(`${code} is already in this graphic.`);
      return;
    }

    const existing = partyCatalog.find((party) => party.code === code);
    const definition = existing ?? {
      code,
      name,
      color: "#7a7a7a",
      affiliation: newPartyAffiliation.trim() || "—",
    };

    if (!existing) {
      setPartyCatalog((current) => [...current, definition]);
      try {
        const saved = JSON.parse(window.localStorage.getItem(PARTY_STORAGE_KEY) ?? "[]") as PartyDefinition[];
        window.localStorage.setItem(PARTY_STORAGE_KEY, JSON.stringify([...saved.filter((item) => item.code !== code), definition]));
      } catch {
        // The new party remains available for the current editor if storage is disabled.
      }
    }
    if (addingPartyFor === null) {
      setParties((current) => [...current, { code, poll: 0 }]);
    } else {
      setParties((current) => current.map((party, i) => i === addingPartyFor ? { ...party, code } : party));
    }

    setNewPartyCode("");
    setNewPartyName("");
    setNewPartyAffiliation("");
    setShowNewPartyForm(false);
    setAddingPartyFor(null);
  }

  function saveNewSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = newSourceName.trim();
    if (!value || !addingSource) return;

    if (addingSource === "pollster") {
      const next = mergeSourceNames(pollsters, [value]);
      setPollsters(next);
      setPollster(value);
      try {
        window.localStorage.setItem(SOURCE_STORAGE_KEY, JSON.stringify({ pollsters: next, commissioners }));
      } catch {
        // The new source remains available for the current editor if storage is disabled.
      }
    } else {
      const next = mergeSourceNames(commissioners, [value]);
      setCommissioners(next);
      setCommissioner(value);
      try {
        window.localStorage.setItem(SOURCE_STORAGE_KEY, JSON.stringify({ pollsters, commissioners: next }));
      } catch {
        // The new source remains available for the current editor if storage is disabled.
      }
    }

    setNewSourceName("");
    setAddingSource(null);
  }

  async function downloadPng() {
    if (!previewRef.current) return;
    setExporting(true);
    setExportError("");

    try {
      await document.fonts.ready;
      const loadAssetData = async (path: string, mimeType: string) => {
        const response = await fetch(path);
        if (!response.ok) throw new Error("Could not load a graphic asset.");
        const buffer = await response.arrayBuffer();
        let binary = "";
        const bytes = new Uint8Array(buffer);
        for (let offset = 0; offset < bytes.length; offset += 0x8000) {
          binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
        }
        return `data:${mimeType};base64,${btoa(binary)}`;
      };
      const [avertaRegular, avertaSemibold, avertaBold, logoDataUrl] = await Promise.all([
        loadAssetData("/fonts/AvertaDemo-Regular.otf", "font/otf"),
        loadAssetData("/fonts/AvertaDemo-Semibold.otf", "font/otf"),
        loadAssetData("/fonts/AvertaDemo-Bold.otf", "font/otf"),
        loadAssetData("/portrait.png", "image/png"),
      ]);
      const svg = previewRef.current.cloneNode(true) as SVGSVGElement;
      svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      svg.querySelectorAll("image").forEach((imageElement) => {
        imageElement.setAttribute("href", logoDataUrl);
      });
      const fontStyle = document.createElementNS("http://www.w3.org/2000/svg", "style");
      fontStyle.textContent = `@font-face{font-family:AvertaExport;src:url('${avertaRegular}') format('opentype');font-weight:400}@font-face{font-family:AvertaExport;src:url('${avertaSemibold}') format('opentype');font-weight:600}@font-face{font-family:AvertaExport;src:url('${avertaBold}') format('opentype');font-weight:700}`;
      svg.insertBefore(fontStyle, svg.firstChild);

      const svgBlob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml;charset=utf-8" });
      const imageUrl = URL.createObjectURL(svgBlob);
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 4000;
        canvas.height = 2000;
        const context = canvas.getContext("2d");
        if (!context) {
          URL.revokeObjectURL(imageUrl);
          setExportError("PNG export is unavailable in this browser.");
          setExporting(false);
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(imageUrl);
          if (!blob) {
            setExportError("The PNG could not be created. Please try again.");
            setExporting(false);
            return;
          }
          const downloadUrl = URL.createObjectURL(blob);
          const anchor = document.createElement("a");
          anchor.href = downloadUrl;
          anchor.download = "ireland-votes-polling-x.png";
          anchor.click();
          URL.revokeObjectURL(downloadUrl);
          setExporting(false);
        }, "image/png");
      };
      image.onerror = () => {
        URL.revokeObjectURL(imageUrl);
        setExportError("The graphic could not be prepared for download. Please try again.");
        setExporting(false);
      };
      image.src = imageUrl;
    } catch {
      setExportError("The graphic could not be exported. Please try again.");
      setExporting(false);
    }
  }

  return (
    <div className="staff-workspace-content">
      <div className="staff-mobile-tabs" aria-label="Graphic editor view">
        <button type="button" aria-pressed={mobilePanel === "edit"} onClick={() => setMobilePanel("edit")}>Edit graphic</button>
        <button type="button" aria-pressed={mobilePanel === "preview"} onClick={() => setMobilePanel("preview")}>Preview</button>
      </div>
      <div className="staff-tool-layout" data-mobile-panel={mobilePanel}>
        <aside className="staff-editor">
          <div className="staff-tool-heading">
            <p className="staff-eyebrow">POLLING GRAPHICS</p>
            <h1>Create a graphic</h1>
            <p>Enter the poll details and figures. Election comparisons are filled from the selected result set.</p>
          </div>

          <section className="staff-editor-section staff-template-section">
            <h2>Start from a template</h2>
            <p className="staff-template-intro">Loads the latest poll details and party figures from the selected dataset.</p>
            {availableComparisonTemplates.length > 0 && (
              <div className="staff-comparison-templates" role="group" aria-label="Quick comparison templates">
                <div className="staff-comparison-template-grid">
                  {availableComparisonTemplates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      className="staff-comparison-template"
                      aria-pressed={comparisonId === template.id}
                      title={`${template.label} ${template.year}`}
                      onClick={() => selectComparison(template.id)}
                    >
                      <span>{template.label}</span>
                      <strong>{template.year}</strong>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {COMPARISON_TEMPLATE_DETAILS[comparisonId]?.sourceNote && (
              <p className="staff-field-note">{COMPARISON_TEMPLATE_DETAILS[comparisonId].sourceNote}</p>
            )}
          </section>

          <section className="staff-editor-section">
            <h2>Graphic details</h2>
            <label>Heading<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>

            <label>Pollster
              <select value={pollster} onChange={(event) => event.target.value === "__add_source__" ? (setAddingSource("pollster"), setNewSourceName("")) : setPollster(event.target.value)}>
                {pollsters.map((item) => <option key={item} value={item}>{item}</option>)}
                <option value="__add_source__">+ Add a pollster&hellip;</option>
              </select>
            </label>
            <label>Commissioned by
              <select value={commissioner} onChange={(event) => event.target.value === "__add_source__" ? (setAddingSource("commissioner"), setNewSourceName("")) : setCommissioner(event.target.value)}>
                {commissioners.map((item) => <option key={item} value={item}>{item}</option>)}
                <option value="__add_source__">+ Add a commissioner&hellip;</option>
              </select>
            </label>
            {addingSource && (
              <form className="staff-inline-add-form" onSubmit={saveNewSource}>
                <input autoFocus aria-label={`New ${addingSource}`} placeholder={addingSource === "pollster" ? "Pollster name" : "Commissioner name"} value={newSourceName} onChange={(event) => setNewSourceName(event.target.value)} />
                <button type="submit">Add</button>
                <button type="button" onClick={() => setAddingSource(null)}>Cancel</button>
              </form>
            )}
            <p className="staff-field-note">Custom source names are saved in this browser.</p>
            <fieldset className="staff-fieldwork-range">
              <legend>Fieldwork dates</legend>
              <label>From<input type="date" value={fieldworkStartDate} onChange={(event) => setFieldworkStartDate(event.target.value)} /></label>
              <label>To<input type="date" value={fieldworkDate} onChange={(event) => setFieldworkDate(event.target.value)} /></label>
            </fieldset>
            <label>Sample size<input type="number" min="1" step="1" value={sampleSize} onChange={(event) => setSampleSize(event.target.value)} placeholder="e.g. 1,000" /></label>
            <label>Compare against
              <select value={comparisonId} onChange={(event) => selectComparison(event.target.value)}>
                {options.elections.map((election) => <option key={election.id} value={election.id}>{election.label}</option>)}
              </select>
            </label>
            {!options.elections.length && <p className="staff-field-note">No compatible party election results were found.</p>}
          </section>

          <section className="staff-editor-section">
            <div className="staff-section-title-row">
              <div><h2>Party results</h2><p>Choose a party and enter this poll&apos;s first-preference share.</p></div>
              <button type="button" className="staff-add-party" onClick={addPartyRow}>Add party</button>
            </div>
            {showNewPartyForm && (
              <form className="staff-new-party-form" onSubmit={saveNewParty}>
                <strong>Add a party</strong>
                <div className="staff-new-party-fields">
                  <label>Acronym<input maxLength={12} value={newPartyCode} onChange={(event) => setNewPartyCode(event.target.value.toUpperCase())} placeholder="e.g. FF" /></label>
                  <label>Party name<input value={newPartyName} onChange={(event) => setNewPartyName(event.target.value)} placeholder="Full party name" /></label>
                  <label>European affiliation<input value={newPartyAffiliation} onChange={(event) => setNewPartyAffiliation(event.target.value)} placeholder="Optional" /></label>
                </div>
                <p className="staff-field-note">Known parties use their Ireland Votes colour. New parties get a neutral grey; colours cannot be edited here.</p>
                {newPartyError && <p className="staff-form-error" role="alert">{newPartyError}</p>}
                <div className="staff-inline-add-form">
                  <button type="submit">Add party</button>
                  <button type="button" onClick={() => { setShowNewPartyForm(false); setAddingPartyFor(null); }}>Cancel</button>
                </div>
              </form>
            )}
            <div className="staff-party-editor-list">
              {parties.map((party, index) => {
                const definition = partyCatalog.find((item) => item.code === party.code) ?? PARTY_BY_CODE[party.code];
                const availableParties = partyCatalog.filter((item) => item.code === party.code || !parties.some((selected) => selected.code === item.code));
                return (
                  <div className="staff-party-editor" key={`${index}-${party.code}`}>
                    <label className="staff-party-choice">Party
                      <select value={party.code} onChange={(event) => updatePartyCode(index, event.target.value)}>
                        {availableParties.map((item) => <option key={item.code} value={item.code}>{item.code} &mdash; {item.name}</option>)}
                        <option value="__add_party__">+ Add a party&hellip;</option>
                      </select>
                    </label>
                    <label>Poll %<input type="number" min="0" max="100" step="0.1" value={party.poll} onChange={(event) => updatePollValue(index, Number(event.target.value) || 0)} /></label>
                    <span className="staff-party-color-swatch" title={`${definition?.name ?? party.code} colour`} style={{ backgroundColor: definition?.color ?? "#7a7a7a" }} />
                    <button type="button" className="staff-remove-party" aria-label={`Remove ${definition?.name ?? party.code}`} onClick={() => setParties((current) => current.filter((_, i) => i !== index))}>x</button>
                  </div>
                );
              })}
            </div>
          </section>
        </aside>

        <section className="staff-preview-area">
          <div className="staff-preview-toolbar">
            <div><p className="staff-eyebrow">TWITTER / X</p><h2>Live preview</h2></div>
            <button type="button" className="staff-generate-post-button" onClick={() => { void openSocialPost(); }}>
              Generate post
            </button>
            <button type="button" className="staff-download-button" onClick={downloadPng} disabled={exporting || parties.length === 0}>
              {exporting ? "Preparing PNG..." : "Download PNG - 4000 x 2000"}
            </button>
          </div>
          <div className="staff-preview-frame">
            <svg ref={previewRef} className="poll-graphic-svg" xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`${title} polling graphic preview`}>
              <defs>
                <linearGradient id="graphic-background" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#11191b" />
                  <stop offset="100%" stopColor="#1b2528" />
                </linearGradient>
                <radialGradient id="graphic-aura">
                  <stop offset="0%" stopColor="#00b9c7" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#00b9c7" stopOpacity="0" />
                </radialGradient>
              </defs>
              <rect width={WIDTH} height={HEIGHT} fill="url(#graphic-background)" />
              <circle cx="1660" cy="400" r="430" fill="url(#graphic-aura)" />
              <rect width={WIDTH} height="8" fill="#00b9c7" />
              <g stroke="#d7eeee" strokeOpacity="0.09" strokeWidth="1">
                <line x1="48" y1="465" x2="2000" y2="465" />
                <line x1="48" y1="610" x2="2000" y2="610" />
                <line x1="48" y1="755" x2="2000" y2="755" />
              </g>
              <line x1="48" y1={BASELINE} x2="2000" y2={BASELINE} stroke="#d7eeee" strokeOpacity="0.28" strokeWidth="1.5" />
              <image href="/portrait.png" x="30" y="14" width="360" height="148" preserveAspectRatio="xMinYMid meet" />
              <g fill="#f4f8f8" fontFamily="AvertaExport, Averta, Arial, sans-serif">
                <text x={WIDTH / 2} y="89" textAnchor="middle" fontSize="72" fontWeight="700" letterSpacing="-4">{title}</text>
                <text x={WIDTH / 2} y="123" textAnchor="middle" fontSize="19" fontWeight="400" letterSpacing="-0.5" fill="#d4e0e1">{subtitle}</text>
                <text x={WIDTH / 2} y="145" textAnchor="middle" fontSize="16" letterSpacing="-0.3" fill="#91a3a5">&copy; 2026 Ireland Votes &mdash; www.irelandvotes.com</text>
                <rect x={WIDTH / 2 - 24} y="160" width="48" height="2" rx="1" fill="#00b9c7" />
              </g>

              <g transform="translate(0 5)" fontFamily="AvertaExport, Averta, Arial, sans-serif" fontSize="10" fill="#e2ebec">
                <defs>
                  <marker id="legend-arrow" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
                    <path d="M0,0 L5,2.5 L0,5" fill="none" stroke="#9cabad" strokeWidth="1" />
                  </marker>
                </defs>
                <text x="1815" y="34" textAnchor="end" letterSpacing="-0.6">Toradh an phobalbhreith seo</text>
                <text x="1815" y="47" textAnchor="end" letterSpacing="-0.6">Result of this poll</text>
                <path d="M1837 43 C1858 43 1890 45 1890 56" fill="none" stroke="#9cabad" strokeWidth="1" markerEnd="url(#legend-arrow)" />
                <rect x="1860" y="62" width="70" height="30" fill="#f4f8f8" />
                <rect x="1930" y="73" width="32" height="19" fill="#78888b" />
                <text x="1900" y="118" textAnchor="end" letterSpacing="-0.6">Toradh toghch&aacute;n {comparisonElection?.label ?? ""}</text>
                <text x="1900" y="131" textAnchor="end" letterSpacing="-0.6">{comparisonElection?.label ?? "Election"} election result</text>
                <path d="M1908 121 C1930 121 1947 111 1947 99" fill="none" stroke="#9cabad" strokeWidth="1" markerEnd="url(#legend-arrow)" />
              </g>

              {parties.map((party, index) => {
                const definition = partyCatalog.find((item) => item.code === party.code) ?? PARTY_BY_CODE[party.code];
                const color = definition?.color ?? "#7a7a7a";
                const comparison = comparisonElection?.partyShares[party.code] ?? 0;
                const chartLeft = 48;
                const chartWidth = 1952;
                const slot = chartWidth / Math.max(parties.length, 1);
                const pollWidth = Math.min(144, slot * 0.66);
                const comparisonWidth = pollWidth * 0.32;
                const pairWidth = pollWidth + comparisonWidth;
                const x = chartLeft + slot * index + (slot - pairWidth) / 2;
                const pollHeight = Math.max(0, party.poll) * barScale;
                const comparisonHeight = Math.max(0, comparison) * barScale;
                const label = party.code === "AP" ? "Alliance" : definition?.graphicName ?? definition?.name ?? party.code;
                const labelFontSize = 40;
                const labelFits = label.length * labelFontSize * 0.46 <= slot * 0.94;
                const partyLabel = labelFits ? label : party.code;
                const partyLabelFontSize = labelFits ? labelFontSize : Math.min(labelFontSize, Math.max(24, (slot * 0.92) / (partyLabel.length * 0.5)));
                const affiliation = definition?.affiliation ?? "N/A";
                const affiliationFontSize = Math.min(13, Math.max(8, (slot * 0.94) / (affiliation.length * 0.53)));
                return (
                  <g key={`${party.code}-${index}`} fontFamily="AvertaExport, Averta, Arial, sans-serif">
                    <rect x={x} y={BASELINE - pollHeight} width={pollWidth} height={pollHeight} fill={color} />
                    <rect x={x + pollWidth} y={BASELINE - comparisonHeight} width={comparisonWidth} height={comparisonHeight} fill={lighten(color)} />
                    {party.poll > 0 && <text x={x + pollWidth / 2} y={BASELINE - pollHeight - 14} textAnchor="middle" fontSize="46" fontWeight="700" letterSpacing="-2" fontFamily="DIN Alternate, DIN, Bahnschrift, Arial Narrow, AvertaExport, Arial, sans-serif" fill="#f4f8f8">{party.poll.toFixed(1)}%</text>}
                    {comparison > 0 && <text x={x + pollWidth + comparisonWidth / 2} y={BASELINE - comparisonHeight - 12} textAnchor="middle" fontSize="14" fontWeight="700" letterSpacing="-0.7" fontFamily="DIN Alternate, DIN, Bahnschrift, Arial Narrow, AvertaExport, Arial, sans-serif" fill="#b7c4c6">{comparison.toFixed(1)}%</text>}
                    <text x={x + pairWidth / 2} y={BASELINE + 54} textAnchor="middle" fontSize={partyLabelFontSize} fontWeight="700" letterSpacing="-1.5" fill="#f4f8f8">{partyLabel}</text>
                    <text x={x + pairWidth / 2} y={BASELINE + 84} textAnchor="middle" fontSize={affiliationFontSize} letterSpacing="-0.5" fill="#b7c4c6">{affiliation}</text>
                  </g>
                );
              })}
            </svg>
          </div>
          {exportError && <p className="staff-form-error" role="alert">{exportError}</p>}
          <p className="staff-export-note">Dark background &middot; 2:1 format &middot; High-resolution PNG export</p>
        </section>
      </div>
      {postPanelOpen && (
        <div className="staff-post-drawer-layer">
          <button type="button" className="staff-post-drawer-backdrop" aria-label="Close post generator" onClick={() => setPostPanelOpen(false)} />
          <aside className="staff-post-drawer" role="dialog" aria-modal="true" aria-labelledby="staff-post-drawer-title">
            <header className="staff-post-drawer-header">
              <div><p className="staff-eyebrow">SOCIAL MEDIA</p><h2 id="staff-post-drawer-title">Generate post</h2></div>
              <button type="button" className="staff-post-drawer-close" autoFocus aria-label="Close post generator" onClick={() => setPostPanelOpen(false)}>Close</button>
            </header>
            <div className="staff-post-drawer-content">
              <div className="staff-post-platform"><span className="staff-post-platform-icon" aria-hidden="true">X</span><div><strong>Twitter / X</strong><span>Ireland Votes polling template</span></div></div>
              <div className={`staff-x-connection${xConnection.connected ? " is-connected" : ""}`}>
                {xConnection.loading
                  ? <span>Checking X connection...</span>
                  : xConnection.connected
                    ? <><span><strong>Connected</strong> as @{xConnection.username}</span><button type="button" onClick={() => { void disconnectX(); }}>Disconnect</button></>
                    : xConnection.configured
                      ? <><span>Connect the Ireland Votes account to publish directly.</span><a href="/api/staff/x/connect">Connect X account</a></>
                      : <span>X publishing needs the X app credentials and encryption key configured in the server environment.</span>}
              </div>
              <label className="staff-post-copy-label" htmlFor="staff-post-copy">Post text <span>{tweetCharacterCount} characters</span></label>
              <textarea id="staff-post-copy" className="staff-tweet-draft" aria-label="Edit generated social media post" value={tweetDraft} onChange={(event) => { setTweetDraft(event.target.value); setXPublishError(""); setPublishedPostUrl(""); }} />
              {tweetCharacterCount > 280 && <p className="staff-post-limit-note">This draft is over X's standard 280-character limit. X may count some characters differently.</p>}
              <div className="staff-x-preview-wrap">
                <p className="staff-post-preview-label">POST PREVIEW</p>
                <article className="staff-x-post-preview">
                  <div className="staff-x-post-author">
                    <span className="staff-x-post-avatar">IV</span>
                    <span><strong>Ireland Votes</strong><small>Polling &amp; electoral analysis</small></span>
                    <b aria-hidden="true">X</b>
                  </div>
                  <p className="staff-x-post-text">{tweetDraft}</p>
                  {graphicPreviewUrl
                    ? <img className="staff-x-post-image" src={graphicPreviewUrl} alt="Preview of the polling graphic attached to the post" />
                    : <div className="staff-x-post-image-placeholder"><span>Polling graphic</span><small>Preparing graphic preview...</small></div>}
                  <div className="staff-x-post-actions" aria-hidden="true"><span>Reply</span><span>Repost</span><span>Like</span><span>Share</span></div>
                </article>
              </div>
              <p className="staff-post-handoff-note">Post to X publishes this text and the graphic above together to the connected account.</p>
              {xPublishError && <p className="staff-post-error" role="alert">{xPublishError}</p>}
              {publishedPostUrl && <p className="staff-post-success" role="status">Published. <a href={publishedPostUrl} target="_blank" rel="noreferrer">View post on X</a></p>}
            </div>
            <footer className="staff-post-drawer-footer">
              <span className="staff-post-copy-status" role="status">{tweetCopyStatus}</span>
              <button type="button" className="staff-copy-tweet-button" onClick={copyTweetText}>Copy post</button>
              <button type="button" className="staff-post-now-button" onClick={() => { void publishToX(); }} disabled={!xConnection.connected || xConnection.loading || xPublishing || Boolean(publishedPostUrl)}>
                {xPublishing ? "Publishing..." : publishedPostUrl ? "Published" : "Post to X"}
              </button>
            </footer>
          </aside>
        </div>
      )}
    </div>
  );
}
