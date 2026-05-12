"use client";

/* =============================
   Party Colours
============================= */

const PARTY_COLORS = {
  FF: "#66bb6a",
  FG: "#5c6bc0",
  SF: "#124940",
  LAB: "#e53935",
  GP: "#43a047",
  SD: "#741d83",
  PBPS: "#da1498",
  AON: "#53660e",
  INDIRL: "#9be736",
  IND: "#7a7a7a",
  IPP: "#0e9775",

  SDLP: "#1a5c1d",
  PBP: "#da1498",
  INDN: "#0c4257",

  DUP: "#dd5454",
  UUP: "#3676c0",
  TUV: "#061730",
  INDU: "#d65f30",

  AP: "#fdd835",

  Yes: "#0a1f94",
  No: "#d4950d"
};

/* =============================
   Imports
============================= */

import { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import Papa from "papaparse";
import "leaflet/dist/leaflet.css";
import { useMap } from "react-leaflet";
import "./map.css";
import { renderToString } from "react-dom/server";
import MapTooltip from "./MapTooltip";

/* =============================
   Dynamic Leaflet Imports (Next.js SSR Safe)
============================= */

const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false }
);

const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
);

const GeoJSON = dynamic(
  () => import("react-leaflet").then((mod) => mod.GeoJSON),
  { ssr: false }
);


/* =============================
   Utility Functions
============================= */

function cleanName(name) {
  if (!name) return "";
  return name.replace(/\s*\(\d+\)/, "").trim();
}

function getTintedScale(hex, value, min, max) {
  let t =
    max > min
      ? (value - min) / (max - min)
      : 0.5;

  t = Math.max(0, Math.min(1, t));

  const rgb = hexToRgb(hex);
  const light = [245, 245, 245];

  const r = light[0] + (rgb[0] - light[0]) * t;
  const g = light[1] + (rgb[1] - light[1]) * t;
  const b = light[2] + (rgb[2] - light[2]) * t;

  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

function getReferendumMarginRange(results) {
  const margins = [];

  Object.values(results || {}).forEach((c) => {
    const first = c?.counts?.[1];
    if (!first) return;

    const yes = first.find(x => x.party === "Yes")?.votes || 0;
    const no = first.find(x => x.party === "No")?.votes || 0;

    const total = yes + no;
    if (!total) return;

    const margin = (yes - no) / total;
    margins.push(margin);
  });

  if (!margins.length) return { min: -1, max: 1 };

  return {
    min: Math.min(...margins),
    max: Math.max(...margins)
  };
}

function getReferendumColor(counts, range) {
  const first = counts?.[1];

  if (!first || first.length < 2) {
    return "transparent";
  }

  const yes =
    first.find(c => c.party === "Yes")?.votes || 0;

  const no =
    first.find(c => c.party === "No")?.votes || 0;

  const total = yes + no;

  if (!total) return "transparent";

  const margin = (yes - no) / total;

  // ==================================================
  // NORMALISED STRENGTH
  // ==================================================

const t = Math.pow(
  Math.min(Math.abs(margin) * 1.8, 1),
  0.55
);

  // ==================================================
  // BASE COLOUR
  // ==================================================

  const base =
    margin >= 0
      ? [0, 90, 255]      // Yes blue
      : [255, 170, 0];    // No gold

  // ==================================================
  // LIGHT TINT
  // ==================================================

  const light = [
    base[0] + (255 - base[0]) * 0.78,
    base[1] + (255 - base[1]) * 0.78,
    base[2] + (255 - base[2]) * 0.78
  ];

  // ==================================================
  // DARK SHADE
  // ==================================================

  const dark = [
    base[0] * 0.58,
    base[1] * 0.58,
    base[2] * 0.58
  ];

  // ==================================================
  // INTERPOLATION
  // ==================================================

  let r, g, b;

  if (t < 0.5) {
    const local = t / 0.5;

    r =
      light[0] +
      (base[0] - light[0]) * local;

    g =
      light[1] +
      (base[1] - light[1]) * local;

    b =
      light[2] +
      (base[2] - light[2]) * local;

  } else {
    const local = (t - 0.5) / 0.5;

    r =
      base[0] +
      (dark[0] - base[0]) * local;

    g =
      base[1] +
      (dark[1] - base[1]) * local;

    b =
      base[2] +
      (dark[2] - base[2]) * local;
  }

  return `rgb(
    ${Math.round(r)},
    ${Math.round(g)},
    ${Math.round(b)}
  )`;
}

function getPresidentialColor(counts) {
  const first =
    counts?.[1] ||
    counts?.["1"];

  if (!first || first.length < 2) {
    return "transparent";
  }

  const sorted = [...first]
    .sort((a, b) => b.votes - a.votes);

  const winner = sorted[0];
  const runner = sorted[1];

  const total = sorted.reduce(
    (sum, c) => sum + (c.votes || 0),
    0
  );

  if (!total) return "transparent";

  // =============================
  // MARGIN
  // =============================

  const margin =
    (winner.votes - runner.votes) / total;

const t = Math.min(
  Math.abs(margin),
  0.7
);

  // smooth continuous curve
  const eased = Math.pow(t, 0.9);

  const base =
    PARTY_COLORS[winner.party] || "#777";

  const rgb = hexToRgb(base);

  // =============================
  // LIGHT → BASE → DARK
  // =============================

 const light = [
  rgb[0] + (255 - rgb[0]) * 0.78,
  rgb[1] + (255 - rgb[1]) * 0.78,
  rgb[2] + (255 - rgb[2]) * 0.78
];

  const dark = [
    rgb[0] * 0.55,
    rgb[1] * 0.55,
    rgb[2] * 0.55
  ];

  let r, g, b;

  if (eased < 0.5) {
    // LIGHT → BASE
    const p = eased / 0.5;

    r =
      light[0] +
      (rgb[0] - light[0]) * p;

    g =
      light[1] +
      (rgb[1] - light[1]) * p;

    b =
      light[2] +
      (rgb[2] - light[2]) * p;

  } else {
    // BASE → DARK
    const p = (eased - 0.5) / 0.5;

    r =
      rgb[0] +
      (dark[0] - rgb[0]) * p;

    g =
      rgb[1] +
      (dark[1] - rgb[1]) * p;

    b =
      rgb[2] +
      (dark[2] - rgb[2]) * p;
  }

  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

function hexToRgb(hex) {
  const num = parseInt(hex.replace("#", ""), 16);

  return [
    (num >> 16) & 255,
    (num >> 8) & 255,
    num & 255
  ];
}

function parseNumber(value) {
  if (!value) return 0;
  return Number(String(value).replace(/,/g, ""));
}

function ReferendumLegend({ range }) {
  if (!range) return null;

  const { min, max } = range;

  // 👉 detect what actually exists in data
  const hasYes = max > 0;
  const hasNo = min < 0;

  const format = (v) => `${(v * 100).toFixed(0)}%`;

  // 👉 dynamic gradient
  let gradient;

  if (hasYes && hasNo) {
    gradient =
      "linear-gradient(to right, rgb(255,170,0), rgb(245,245,245), rgb(0,90,255))";
  } else if (hasNo) {
    gradient =
      "linear-gradient(to right, rgb(255,170,0), rgb(245,245,245))";
  } else {
    gradient =
      "linear-gradient(to right, rgb(245,245,245), rgb(0,90,255))";
  }

  return (
    <div
      style={{
        position: "absolute",
        bottom: "20px",
        right: "20px",
        zIndex: 1000,
        padding: "10px 12px",
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderRadius: "10px",
        fontSize: "11px",
        color: "var(--text)",
        width: "200px"
      }}
    >

      {/* TITLE */}
      <div style={{ marginBottom: "6px", fontWeight: 600 }}>
        {hasYes && hasNo
          ? "Margin"
          : hasNo
          ? "No Majority"
          : "Yes Majority"}
      </div>

      {/* GRADIENT */}
      <div
        style={{
          height: "10px",
          borderRadius: "6px",
          marginBottom: "6px",
          background: gradient
        }}
      />

      {/* VALUE LABELS */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: "10px",
          opacity: 0.8
        }}
      >
        {hasNo && <span>{format(min)}</span>}

        {hasYes && hasNo && <span>0%</span>}

        {hasYes && <span>{format(max)}</span>}
      </div>

      {/* SIDE LABELS */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: "4px",
          fontSize: "10px",
          opacity: 0.6
        }}
      >
        {hasNo && <span>No</span>}
        {hasYes && <span style={{ marginLeft: "auto" }}>Yes</span>}
      </div>

    </div>
  );
}

function parseConstituency(name) {
  if (!name) return { name: "", seats: null };

  const match = name.match(/(.*)\((\d+)\)/);

  if (match) {
    return {
      name: match[1].trim(),
      seats: Number(match[2])
    };
  }

  return {
    name: name.trim(),
    seats: null
  };
}

function getIrelandBounds(geoData) {
  const layer = L.geoJSON(geoData);
  return layer.getBounds();
}

function ZoomControls() {
  const map = useMap();

  return (
    <div
      style={{
        position: "absolute",
        top: "20px",
        left: "20px",
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        gap: "4px"
      }}
    >
<button
  onClick={() => map.zoomIn()}
  style={zoomStyle}
  onMouseEnter={(e) =>
    (e.currentTarget.style.background = "var(--panel-2)")
  }
  onMouseLeave={(e) =>
    (e.currentTarget.style.background = "var(--panel)")
  }
>
  +
</button>

<button
  onClick={() => map.zoomOut()}
  style={zoomStyle}
  onMouseEnter={(e) =>
    (e.currentTarget.style.background = "var(--panel-2)")
  }
  onMouseLeave={(e) =>
    (e.currentTarget.style.background = "var(--panel)")
  }
>
  −
</button>
    </div>
  );
}

const zoomStyle = {
  width: "32px",
  height: "32px",
  background: "var(--panel)",
  border: "1px solid var(--border)",
  color: "var(--text)",
  borderRadius: "8px",
  cursor: "pointer",
  fontSize: "16px",
  fontWeight: "600",
  transition: "background 0.15s ease"
};

/* =============================
   Reset Map Button
============================= */

function ResetButton({ onReset, geoJsonRef }) {
  const map = useMap();

  return (
    <button
onClick={() => {
  onReset?.();

  // 👇 force map controller to run
  window.dispatchEvent(new Event("map-reset"));
}}
style={{
  position: "absolute",
  bottom: "20px",
  left: "20px",
  zIndex: 1000,
  padding: "8px 12px",
  background: "var(--panel)",
  border: "1px solid var(--border)",
  cursor: "pointer",
  color: "var(--text)",
  borderRadius: "8px",
  fontSize: "12px",
}}
    >
      Reset
    </button>
  );
}

/* =============================
   Zoom To Selected Constituency
============================= */

function ZoomToSelected({ selected, geoJsonRef, resetTrigger }) {
  const map = useMap();

  useEffect(() => {
    if (!selected || !geoJsonRef.current) return;

    let largestLayer = null;
    let largestArea = 0;

    geoJsonRef.current.eachLayer((layer) => {
      const name = cleanName(
        layer.feature.properties.ENG_NAME_VALUE
      );

      if (name === selected.name) {
        const bounds = layer.getBounds();

        const area =
          Math.abs(
            (bounds.getNorth() - bounds.getSouth()) *
            (bounds.getEast() - bounds.getWest())
          );

        if (area > largestArea) {
          largestArea = area;
          largestLayer = layer;
        }
      }
    });

    if (largestLayer) {
      map.fitBounds(largestLayer.getBounds(), {
        padding: [30, 30],
        maxZoom: 10,
        animate: true,
        duration: 0.6
      });
    }

  }, [selected, resetTrigger]);

  return null;
}

function MapController({ geoData, selected, resetTrigger, geoJsonRef }) {
  const map = useMap();

useEffect(() => {
  const id = setTimeout(() => {
    map.invalidateSize();
  }, 100);

  return () => clearTimeout(id);
}, [map]);

  // =============================
  // Fit Options (zoom + padding)
  // =============================
  function getFitOptions(bounds) {
    const latDiff = bounds.getNorth() - bounds.getSouth();
    const lngDiff = bounds.getEast() - bounds.getWest();
    const size = Math.max(latDiff, lngDiff);

    let maxZoom;

    if (size < 0.02) maxZoom = 14;
    else if (size < 0.1) maxZoom = 12;
    else if (size < 0.5) maxZoom = 10;
    else maxZoom = 8.2;

let padding;

// national / large maps
if (size > 2) {
  padding = [60, 60];
}

// medium regions
else if (size > 0.5) {
  padding = [40, 40];
}

// tiny constituencies
else if (size < 0.02) {
  padding = window.innerWidth < 1200
    ? [40, 40]
    : [120, 120];
}

// default
else {
  padding = [30, 30];
}

    return { maxZoom, padding };
  }

  // =============================
  // Screen Fill Helper
  // =============================
  function applyScreenFill(bounds, multiplier = 0.8) {
    setTimeout(() => {
      const ne = map.project(bounds.getNorthEast());
      const sw = map.project(bounds.getSouthWest());

      const width = Math.abs(ne.x - sw.x);
      const height = Math.abs(ne.y - sw.y);

      const mapSize = map.getSize();

      const ratio = Math.max(
        width / mapSize.x,
        height / mapSize.y
      );

      if (ratio < 0.75) {
const zoomBoost = Math.min(
  2, // 👈 HARD LIMIT (prevents crazy jumps)
  Math.log2(1 / ratio)
);

map.setZoom(map.getZoom() + zoomBoost * multiplier);
      }
    }, 80);
  }

  // =============================
  // RESET HANDLER (works always)
  // =============================
useEffect(() => {
  const handleReset = () => {
    if (!geoData) return;

    const bounds = L.geoJSON(geoData).getBounds();
    const { maxZoom, padding } = getFitOptions(bounds);

    map.fitBounds(bounds, {
      padding,
      maxZoom,
      animate: true,
      duration: 0.6
    });

    applyScreenFill(bounds, 0.8);
  };

  window.addEventListener("map-reset", handleReset);

  return () => {
    window.removeEventListener("map-reset", handleReset);
  };
}, [geoData, map]);

  // =============================
  // MAIN FIT LOGIC
  // =============================
  useEffect(() => {
    if (!geoData) return;

    const bounds = L.geoJSON(geoData).getBounds();

    // =============================
    // NATIONAL VIEW
    // =============================
    if (!selected) {
      const { maxZoom, padding } = getFitOptions(bounds);

      map.fitBounds(bounds, {
        padding,
        maxZoom,
        animate: true,
        duration: 0.5
      });

      applyScreenFill(bounds, 0.8);
      return;
    }

    // =============================
    // SELECTED VIEW (combined bounds)
    // =============================
    let combinedBounds = null;

    geoJsonRef.current?.eachLayer((layer) => {
      const name = cleanName(
        layer.feature.properties.ENG_NAME_VALUE
      );

      if (name === selected.name) {
        const b = layer.getBounds();

        if (!combinedBounds) {
          combinedBounds = b;
        } else {
          combinedBounds.extend(b);
        }
      }
    });

    if (combinedBounds) {
      const { padding } = getFitOptions(combinedBounds);

      map.fitBounds(combinedBounds, {
        padding,
        animate: true,
        duration: 0.6
      });

      // 👇 softer zoom for selected (less aggressive)
      applyScreenFill(combinedBounds, 0.4);
    }

  }, [geoData, selected, resetTrigger, map]);

  // =============================
  // RESIZE HANDLING
  // =============================
  useEffect(() => {
    if (!geoData) return;

    let timeout;

    const handleResize = () => {
      clearTimeout(timeout);

      timeout = setTimeout(() => {
        map.invalidateSize();

        let bounds;

        if (selected && geoJsonRef.current) {
          let combinedBounds = null;

          geoJsonRef.current.eachLayer((layer) => {
            const name = cleanName(
              layer.feature.properties.ENG_NAME_VALUE
            );

            if (name === selected.name) {
              const b = layer.getBounds();

              if (!combinedBounds) {
                combinedBounds = b;
              } else {
                combinedBounds.extend(b);
              }
            }
          });

          bounds = combinedBounds;

        } else {
          bounds = L.geoJSON(geoData).getBounds();
        }

        if (!bounds) return;

        const { maxZoom, padding } = getFitOptions(bounds);

        map.fitBounds(bounds, {
          padding,
          maxZoom,
          animate: false
        });

        // 👇 keep screen-fill consistent after resize
        if (selected) {
  applyScreenFill(bounds, 0.4);
}

      }, 150);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(timeout);
    };
  }, [geoData, selected, map]);

  return null;
}
/* =============================
   Main Map Component
============================= */

export default function Map({
  election,
  selected,
  view,
  onSelect,
  onLoadTotal,
  onLoadList,
  onLoadResults,
  onLoadOfficialResults,
  resetTrigger,
  results,
  count,
  onLoadPreviousResults,
  onLoadProjection
}) {
  const [geoData, setGeoData] = useState(null);
  const geoJsonRef = useRef();
  const mapRef = useRef(null);
  const isMobile =
  typeof window !== "undefined" &&
  window.innerWidth < 900;
  const leafletRef = useRef(null);
  const [previousResults, setPreviousResults] = useState([]);
  const [officialResults, setOfficialResults] = useState(null);
  const hasOfficialData = useRef(false);
const mobileTooltipRef = useRef(null);
const country = election?.country || "ireland";
const type = election?.type || "dail";
const year = election?.year || "2024";
const slug = election?.slug;
const isFPTP =
  type === "house-of-commons";

const dataPath = slug
  ? `/data/elections/${country}/${type}/${year}/${slug}`
  : `/data/elections/${country}/${type}/${year}`;

const [isDark, setIsDark] = useState(true);

useEffect(() => {
  const panes = document.querySelectorAll(".leaflet-pane");

  panes.forEach((pane) => {
    pane.style.background =
      isDark ? "#1f1f1f" : "#f8f8f8";
  });

}, [isDark]);

useEffect(() => {
  const updateTheme = () => {
    setIsDark(
      document.documentElement.classList.contains("dark")
    );
  };

  updateTheme();

  const observer = new MutationObserver(updateTheme);

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"]
  });

  return () => observer.disconnect();
}, []);

useEffect(() => {
  if (typeof window === "undefined") return;

  Promise.all([
    import("leaflet"),
    import("leaflet-gesture-handling"),
    import(
      "leaflet-gesture-handling/dist/leaflet-gesture-handling.css"
    )
  ]).then(([leaflet]) => {
    const L = leaflet.default;

    leafletRef.current = L;

    L.Map.addInitHook(
      "addHandler",
      "gestureHandling",
      L.GestureHandling
    );

    if (mapRef.current) {
      mapRef.current.gestureHandling.enable();
    }
  });
}, []);

  /* =============================
     Load GeoJSON Boundary Data
  ============================= */

useEffect(() => {
  fetch(`${dataPath}/boundaries.geojson`)
    .then((res) => res.json())
    .then((data) => {

      const seatMap = {};

      data.features.forEach((f) => {
        const parsed = parseConstituency(
          f.properties.ENG_NAME_VALUE
        );

        if (parsed.seats) {
          seatMap[parsed.name] = parsed.seats;
        }
      });

setGeoData(data);
window.geoData = data; // 👈 add this
    });
}, [dataPath]);


  /* =============================
     Load Election CSV Data
  ============================= */

useEffect(() => {
  fetch(`${dataPath}/projection.json`)
    .then((res) => res.json())
    .then((data) => {
      if (onLoadProjection) {
        onLoadProjection(data);
      }
    })
    .catch(() => {
      // fail silently if no projection exists
      if (onLoadProjection) {
        onLoadProjection(null);
      }
    });
}, [dataPath]);

  useEffect(() => {
    fetch(`${dataPath}/election_data.csv`)
      .then((res) => res.text())
      .then((csv) => {
        const parsed = Papa.parse(csv, {
          header: true,
          skipEmptyLines: true,
        }).data;

        const grouped = {};
        const seatMap = {};

        parsed.forEach((row) => {
          const constituency = row.constituency?.trim();
          const count = Number(row.count);

          const seats = Number(row.seats);

if (constituency && seats) {
  seatMap[constituency] = seats;
}

          if (!constituency) return;

          if (!grouped[constituency]) {
            grouped[constituency] = { counts: {} };
          }

if (row.auto_return_candidate) {
  grouped[constituency].automaticReturn = {
    candidate: row.auto_return_candidate,
    party: row.auto_return_party,
    reason: row.auto_return_reason
  };
}

          const name =
            row.candidate_name ||
            row.Candidate ||
            row.candidate;

          if (!name) return;

          if (!grouped[constituency].counts[count]) {
            grouped[constituency].counts[count] = [];
          }

          if (!grouped[constituency].seats && row.seats) {
  grouped[constituency].seats = Number(row.seats);
}

grouped[constituency].counts[count].push({
  id: `${name}-${row.party}-${count}`,
  imageId: `${row.candidate_id}-${row.party}`,
  name,
  party: row.party,

  votes: parseNumber(row.votes),

  status: row.status?.toLowerCase() || "running",
  incumbent: row.incumbent === "TRUE",

  seats: parseNumber(row.seats),
  quota: parseNumber(row.quota),
  electorate: parseNumber(row.electorate),
  turnout: parseNumber(row.turnout),
  tvp: parseNumber(row.tvp),
  spoilt: parseNumber(row.spoilt),
});
        });

        console.log("GROUPED:", grouped);

        window.results = grouped;

Object.keys(grouped).forEach((c) => {
  if (!grouped[c].seats) {
    grouped[c].seats = seatMap[c] || 0;
  }
});

if (!hasOfficialData.current) {
  console.log("USING TALLY DATA");

  onLoadResults(grouped);
  onLoadList(Object.keys(grouped));
}
        
      });
  }, [dataPath]);

useEffect(() => {
  fetch(`${dataPath}/count_data.csv`)
    .then((res) => {
      if (!res.ok) throw new Error("no official data");
      return res.text();
    })
    .then((csv) => {

hasOfficialData.current = true;
console.log("USING COUNT DATA");

      const parsed = Papa.parse(csv, {
        header: true,
        skipEmptyLines: true,
      }).data;

      const grouped = {};

      parsed.forEach((row) => {
        const constituency = row.constituency?.trim();
        const count = Number(row.count);

        if (!constituency) return;

        if (!grouped[constituency]) {
          grouped[constituency] = { counts: {} };
        }

        if (!grouped[constituency].counts[count]) {
          grouped[constituency].counts[count] = [];
        }

        const name =
          row.candidate_name ||
          row.Candidate ||
          row.candidate;

        if (!name) return;

        grouped[constituency].counts[count].push({
          id: `${name}-${row.party}-${count}`,
          name,
          party: row.party,
          votes: parseNumber(row.votes),
          status: row.status?.toLowerCase() || "running",
          incumbent: row.incumbent === "TRUE",
          seats: parseNumber(row.seats),
          quota: parseNumber(row.quota),
          electorate: parseNumber(row.electorate),
          turnout: parseNumber(row.turnout),
          tvp: parseNumber(row.tvp),
          spoilt: parseNumber(row.spoilt),
        });
      });

      console.log("OFFICIAL RESULTS:", grouped);

      if (onLoadOfficialResults) {
        onLoadOfficialResults(grouped);
      }
    })
.catch(() => {
  console.log("No official results available");
});
}, [dataPath]);

/* =============================
   Load Previous Results CSV
============================= */

useEffect(() => {
  fetch(`${dataPath}/previous_results.csv`)
    .then((res) => res.text())
    .then((csv) => {
      const parsed = Papa.parse(csv, {
        header: true,
        skipEmptyLines: true,
      }).data;

      const grouped = {};

      parsed.forEach((row) => {
        const constituency = row.constituency?.trim();
        const party = row.party?.trim();

        if (!constituency || !party) return;

        if (!grouped[constituency]) {
          grouped[constituency] = {};
        }

        grouped[constituency][party] = {
          votes: Number(row.votes) || 0,
          seats: Number(row.seats) || 0,
        };
      });

      console.log("PREVIOUS RESULTS:", grouped);

      window.previousResults = grouped;

      setPreviousResults(grouped);

      if (onLoadPreviousResults) {
        onLoadPreviousResults(grouped);
      }
    });
}, [dataPath]);

/* =============================
   Greyscale Utility
============================= */

function getGreyScale(value, min, max) {
  if (value == null) return "transparent";

  const ratio = (value - min) / (max - min || 1);

  const shade = Math.floor(230 - ratio * 170);

  return `rgb(${shade}, ${shade}, ${shade})`;
}


/* =============================
   Turnout / Spoilt Ranges
============================= */

const marginRange = getReferendumMarginRange(results);

function getRanges(results) {
  const turnout = [];
  const spoilt = [];

  Object.values(results || {}).forEach((c) => {
    const first = c?.counts?.[1]?.[0];

    if (!first) return;

    if (first.turnout && first.electorate) {
      turnout.push(first.turnout / first.electorate);
    }

    if (first.spoilt && first.turnout) {
      spoilt.push(first.spoilt / first.turnout);
    }
  });

  return {
    turnoutMin: Math.min(...turnout),
    turnoutMax: Math.max(...turnout),
    spoiltMin: Math.min(...spoilt),
    spoiltMax: Math.max(...spoilt),
    referendumMargin: getReferendumMarginRange(results),
  };
}

const ranges = getRanges(results);

/* =============================
   Tooltip Builder
============================= */

function getTooltip(name, results, view, ranges) {
  const constituency = results?.[name];
  if (!constituency?.counts) return name;

  const first = constituency.counts[1];
  if (!first?.length) return name;

  /* =============================
     Largest Party
  ============================= */

 if (view === "party" || view === "winner") {
    const partyTotals = {};

    first.forEach((c) => {
      partyTotals[c.party] =
        (partyTotals[c.party] || 0) + c.votes;
    });

    const sorted = Object.entries(partyTotals)
      .sort((a, b) => b[1] - a[1]);

    const winner = sorted[0];
    const runner = sorted[1];

    const totalVotes = Object.values(partyTotals)
      .reduce((a, b) => a + b, 0);

    const winnerPercent =
      ((winner[1] / totalVotes) * 100).toFixed(1);

    const lead =
      runner
        ? ((winner[1] - runner[1]) / totalVotes * 100).toFixed(1)
        : 0;

    return `
      <b>${name}</b><br/>
      Largest Party: <b>${winner[0]}</b><br/>
      ${winnerPercent}%<br/>
      Lead: +${lead}%
    `;
  }

  /* =============================
     Poll Topper
  ============================= */

  if (view === "count") {
    const sorted = [...first]
      .sort((a, b) => b.votes - a.votes);

    const winner = sorted[0];
    const runner = sorted[1];

    const totalVotes = sorted
      .reduce((sum, c) => sum + c.votes, 0);

    const percent =
      ((winner.votes / totalVotes) * 100).toFixed(1);

    const lead =
      runner
        ? ((winner.votes - runner.votes) / totalVotes * 100).toFixed(1)
        : 0;

    return `
      <b>${name}</b><br/>
      ${winner.name} (${winner.party})<br/>
      ${percent}%<br/>
      Lead: +${lead}%
    `;
  }

  /* =============================
     Turnout
  ============================= */

  if (view === "turnout") {
    const data = first[0];

    const percent =
      (data.turnout / data.electorate * 100).toFixed(1);

    const avg =
      ((ranges.turnoutMin + ranges.turnoutMax) / 2) * 100;

    const diff =
      (percent - avg).toFixed(1);

    return `
      <b>${name}</b><br/>
      Turnout<br/>
      ${data.turnout.toLocaleString()}<br/>
      ${percent}%<br/>
      ${diff > 0 ? "+" : ""}${diff} vs average
    `;
  }

  /* =============================
     Spoilt
  ============================= */

  if (view === "spoilt") {
    const data = first[0];

    const percent =
      (data.spoilt / data.turnout * 100).toFixed(2);

    const avg =
      ((ranges.spoiltMin + ranges.spoiltMax) / 2) * 100;

    const diff =
      (percent - avg).toFixed(2);

    return `
      <b>${name}</b><br/>
      Spoilt Ballots<br/>
      ${data.spoilt.toLocaleString()}<br/>
      ${percent}%<br/>
      ${diff > 0 ? "+" : ""}${diff} vs average
    `;
  }

/* =============================
   Margin
============================= */

if (view === "margin") {
  const sorted = [...first].sort((a, b) => b.votes - a.votes);

  const winner = sorted[0];
  const runner = sorted[1];

  if (!winner) return `<b>${name}</b>`;

  const totalVotes = sorted.reduce(
    (sum, c) => sum + c.votes,
    0
  );

  const winnerPercent =
    totalVotes
      ? (winner.votes / totalVotes) * 100
      : 0;

  const runnerPercent =
    runner && totalVotes
      ? (runner.votes / totalVotes) * 100
      : 0;

  const margin = winnerPercent - runnerPercent;

  return `
    <b>${name}</b><br/>
    Margin<br/>
    ${winner.party || winner.name}<br/>
    +${margin.toFixed(1)}%
  `;
}

  return `<b>${name}</b>`;
}

/* =============================
   Update Tooltips
============================= */

useEffect(() => {
  if (!geoJsonRef.current) return;

  geoJsonRef.current.eachLayer((layer) => {
    const key = cleanName(
      layer.feature.properties.ENG_NAME_VALUE
    );

layer.bindTooltip(
  renderToString(
    <MapTooltip
      name={key}
      constituency={results?.[key]}
      view={view}
      count={count}
    />
  ),
  {
    sticky: true,
    direction: "auto",
    offset: [0, -8],
    opacity: 0.98,
    className: "map-tooltip"
  }
);
  });

}, [view, results, count, geoData]);

useEffect(() => {
  if (!geoJsonRef.current || !selected) return;

  // slight delay to ensure layers rendered
  setTimeout(() => {
    geoJsonRef.current.eachLayer((layer) => {
      const key = cleanName(
        layer.feature.properties.ENG_NAME_VALUE
      );

      if (key === selected.name) {
        layer.bringToFront();
      }
    });
  }, 0);

}, [selected]);

  /* =============================
     Constituency Styling
  ============================= */

function isGainConstituency(name) {

  if (type !== "house-of-commons") {
    return false;
  }

  const constituency = results?.[name];
  if (!constituency?.counts?.[1]) {
    return false;
  }

  const first = constituency.counts[1];

  // winning party
  const winner = [...first]
    .sort((a, b) => b.votes - a.votes)[0];

  if (!winner) {
    return false;
  }

  // outgoing party from previous_results.csv
  const previous =
    previousResults?.[name];

  if (!previous) {
    return false;
  }

  const previousWinner =
    Object.entries(previous)
      .sort(
        (a, b) =>
          b[1].votes - a[1].votes
      )[0]?.[0];

  if (!previousWinner) {
    return false;
  }

  return winner.party !== previousWinner;
}

function getWinningMapParty(first) {

  const partyTotals = {};
  let strongestIndependent = 0;

  first.forEach((c) => {

    const votes = c.votes || 0;

    const isIndependent =
      c.party === "IND" ||
      c.party === "INDN" ||
      c.party === "INDU";

    if (isIndependent) {

      // track strongest INDIVIDUAL independent
      strongestIndependent = Math.max(
        strongestIndependent,
        votes
      );

      return;
    }

    // grouped political parties
    partyTotals[c.party] =
      (partyTotals[c.party] || 0) + votes;
  });

  const topParty = Object.entries(partyTotals)
    .sort((a, b) => b[1] - a[1])[0];

  const topPartyVotes =
    topParty?.[1] || 0;

  // IND only wins if an INDIVIDUAL beats top party
  if (
    strongestIndependent >
    topPartyVotes
  ) {
    return "IND";
  }

  return topParty?.[0] || "IND";
}

function getColor(name) {
  const constituency = results?.[name];
  if (!constituency?.counts) return "transparent";

  const counts = constituency.counts;

const first = counts[1];

const totalVotes = first?.reduce(
  (sum, c) => sum + (c.votes || 0),
  0
) || 0;

if (totalVotes === 0) return "transparent";

if (type?.startsWith("referendum")) {
  if (view === "margin") {
    return getReferendumColor(counts, marginRange);
  }

if (view === "party" || view === "winner") {
  const first = counts[1];
  if (!first?.length) return "transparent";

  let yesVotes = 0;
  let noVotes = 0;

  first.forEach((c) => {
    if (c.party === "Yes") yesVotes += c.votes || 0;
    if (c.party === "No") noVotes += c.votes || 0;
  });

  return yesVotes >= noVotes
    ? PARTY_COLORS["Yes"]
    : PARTY_COLORS["No"];
}

if (view === "turnout") {
  const first = counts[1]?.[0];
  if (!first) return "transparent";

  const percent =
    first.turnout / first.electorate;

  return getTintedScale(
    "#4caf50",
    percent,
    ranges.turnoutMin,
    ranges.turnoutMax
  );
}

if (view === "spoilt") {
  const first = counts[1]?.[0];
  if (!first) return "transparent";

  const percent =
    first.spoilt / first.turnout;

  return getTintedScale(
    "#ff5252",
    percent,
    ranges.spoiltMin,
    ranges.spoiltMax
  );
}

  return "transparent";
}

if (view === "margin") {

if (
  type?.startsWith("president") ||
  type === "dail" ||
  type === "house-of-commons"
) {
return getPresidentialColor(counts)
}

}

  // NATIONAL VIEW
  if (!selected) {

    // Largest Party
    if (view === "party" || view === "winner") {
      const first = counts[1];
      if (!first?.length) return "transparent";

const winner =
  getWinningMapParty(first);

return PARTY_COLORS[winner] || "transparent";
    }

    // Poll-topping candidate
    if (view === "count") {
      const first = counts[1];
      if (!first?.length) return "transparent";

      const leader = [...first]
        .sort((a, b) => b.votes - a.votes)[0];

      return PARTY_COLORS[leader?.party] || "transparent";
    }

if (view === "turnout") {
  const first = counts[1]?.[0];
  if (!first) return "transparent";

  const percent =
    first.turnout / first.electorate;

  return getTintedScale(
    "#4caf50",
    percent,
    ranges.turnoutMin,
    ranges.turnoutMax
  );
}

if (view === "spoilt") {
  const first = counts[1]?.[0];
  if (!first) return "transparent";

  const percent =
    first.spoilt / first.turnout;

  return getTintedScale(
    "#ff5252",
    percent,
    ranges.spoiltMin,
    ranges.spoiltMax
  );
}

  }

  // CONSTITUENCY VIEW

  if (view === "party" || view === "winner") {
    const first = counts[1];
    if (!first?.length) return "transparent";

const winner =
  getWinningMapParty(first);

return PARTY_COLORS[winner] || "transparent";
  }

const displayCount =
  view === "count"
    ? 1
    : count;

  if (view === "count") {
    const data = counts[displayCount]
    if (!data?.length) return "transparent";

    const leader = [...data]
      .sort((a, b) => b.votes - a.votes)[0];

    return PARTY_COLORS[leader?.party] || "transparent";
  }

  return "transparent";
}

const [isClient, setIsClient] = useState(false);

useEffect(() => {
  setIsClient(true);
}, []);

  /* =============================
     Map Render
  ============================= */

return (
  <div
    key={`${country}-${type}-${year}`}
    style={{
      position: "relative",
      height: "100%",
      width: "100%",
      background: isDark ? "#1f1f1f" : "#f8f8f8"
    }}
  >
    
<MapContainer
  whenCreated={(map) => {
    if (mapRef.current) {
      mapRef.current.remove();
    }

    mapRef.current = map;

requestAnimationFrame(() => {
  setTimeout(() => {
    map.invalidateSize();
  }, 50);
});
  }}
  minZoom={6.5}
  maxZoom={18}
  zoomSnap={0}       // 👈 allows fractional zoom (CRITICAL)
  zoomDelta={0.25}   // 👈 smaller zoom steps
  zoomControl={false}
  style={{
    height: "100%",
    width: "100%",
    background: isDark ? "#1f1f1f" : "#f8f8f8"
  }}
  scrollWheelZoom={true}
  dragging={!isMobile}
wheelDebounceTime={120}
wheelPxPerZoomLevel={240}
touchZoom="center"
 onClick={() => {
  mobileTooltipRef.current = null;
  onSelect(null);
}}
>

<svg width="0" height="0">

  <defs>

    <pattern
      id="gainHatch"
      patternUnits="userSpaceOnUse"
      width="8"
      height="8"
      patternTransform="rotate(135)"
    >
      <line
        x1="0"
        y1="0"
        x2="0"
        y2="8"
        stroke="rgba(0,0,0,0.22)"
        strokeWidth="8"
      />
    </pattern>

  </defs>

</svg>

<MapController
  geoData={geoData}
  selected={selected}
  resetTrigger={resetTrigger}
  geoJsonRef={geoJsonRef}
/>

<ZoomControls />

        {/* Reset Button */}
        <ResetButton
          geoJsonRef={geoJsonRef}
          onReset={() => onSelect(null)}
        />

{/* IRELAND MASK */}
{geoData && (
<GeoJSON
data={geoData}
style={{
fillColor: isDark ? "#1f1f1f" : "#f8f8f8",
fillOpacity: 1,
stroke: false,
interactive: false
}}
/>
)}

        {/* Constituency Boundaries */}
        {geoData && (
          <GeoJSON
           key={`${selected?.name || "national"}-${view}`}
          ref={geoJsonRef}
            data={geoData}
            style={(feature) => {
              const key = cleanName(
                feature.properties.ENG_NAME_VALUE
              );

              const isSelected = selected?.name === key;

return {
  color: isSelected
    ? "var(--map-outline-selected)"
    : "var(--map-outline)",
  weight: isSelected ? 4 : 1,
                fillColor: getColor(key),
                fillOpacity: getColor(key) === "transparent"
                ? 0
                : isSelected ? 1 : 0.5,
              };
            }}
onEachFeature={(feature, layer) => {
  const key = cleanName(
    feature.properties.ENG_NAME_VALUE
  );

  layer.on({
mouseover: (e) => {
  const hoveredLayer = e.target;

  const hoveredKey = cleanName(
    hoveredLayer.feature.properties.ENG_NAME_VALUE
  );

  geoJsonRef.current.eachLayer((l) => {
    const layerKey = cleanName(
      l.feature.properties.ENG_NAME_VALUE
    );

    if (layerKey === hoveredKey) {
      const isSelected =
        selected?.name === layerKey;

      if (!isSelected) {
const fill =
  l.options.fillColor ||
  l._savedFillColor ||
  "#999";

        l.setStyle({
          weight: 2,
          color: "var(--map-outline-hover)",
          fillColor: fill,
          fillOpacity:
            isDark ? 0.75 : 0.65
        });
      }
    }
  });
},

    mouseout: (e) => {
      const hoveredLayer = e.target;

      const hoveredKey = cleanName(
        hoveredLayer.feature.properties.ENG_NAME_VALUE
      );

      geoJsonRef.current.eachLayer((l) => {
        const layerKey = cleanName(
          l.feature.properties.ENG_NAME_VALUE
        );

        if (layerKey === hoveredKey) {
          const isSelected =
            selected?.name === layerKey;

          if (!isSelected) {
const color =
  l.options.fillColor ||
  l._savedFillColor ||
  getColor(layerKey);

l.setStyle({
  color: "var(--map-outline)",
  weight: 1,
  fillColor: color,
  fillOpacity:
    color === "transparent"
      ? 0
      : 0.5
});
          }
        }
      });
    },

click: (e) => {
  e.originalEvent.stopPropagation();

  // MOBILE
  if (window.innerWidth < 900) {

    const alreadyOpen =
      mobileTooltipRef.current === key;

    // FIRST TAP → open tooltip
    if (!alreadyOpen) {

      mobileTooltipRef.current = key;

      layer.openTooltip(e.latlng);

      return;
    }

    // SECOND TAP → clear + select
    mobileTooltipRef.current = null;
  }

  // DESKTOP + SECOND MOBILE TAP
  setTimeout(() => {

    if (selected?.name === key) return;

    onSelect({
      name: key,
      data: undefined
    });

  }, 100);
}
  });
}}
          />
        )}

{/* Gain Overlay */}
{geoData &&
  type === "house-of-commons" &&
  view === "party" && (
<GeoJSON
  key={`gain-overlay-${selected?.name || "national"}`}
  data={geoData}

  style={(feature) => {

    const key = cleanName(
      feature.properties.ENG_NAME_VALUE
    );

    if (!isGainConstituency(key)) {
      return {
        fillOpacity: 0,
        opacity: 0
      };
    }

    const isSelected =
      selected?.name === key;

    return {
      color: "transparent",
      weight: 0,

      fill: true,
      fillColor: "url(#gainHatch)",

      fillOpacity:
        selected
          ? 1
          : 0.5,

      interactive: false
    };
  }}

  onEachFeature={(feature, layer) => {
    if (layer._path) {
      layer._path.style.pointerEvents = "none";
    }

    layer.on("add", () => {
      if (layer._path) {
        layer._path.style.pointerEvents = "none";
      }
    });
  }}
/>
)}

{type?.startsWith("referendum") && (
  <ReferendumLegend range={marginRange} />
)}

{type === "house-of-commons" &&
  view === "party" && (
  <div
    style={{
      position: "absolute",
      bottom: "20px",
      right: "20px",
      zIndex: 1000,

      display: "flex",
      alignItems: "center",
      gap: "8px",

      padding: "8px 12px",

      background: "var(--panel)",
      border: "1px solid var(--border)",
      borderRadius: "10px",

      fontSize: "11px",
      color: "var(--text)"
    }}
  >

    <div
      style={{
        width: "18px",
        height: "18px",
        borderRadius: "4px",

        background:
          "repeating-linear-gradient(45deg, rgba(102, 102, 102, 0.22) 0px, rgba(102, 102, 102, 0.22) 3px, transparent 3px, transparent 8px)"
      }}
    />

    <span>
      Denotes a gain
    </span>

  </div>
)}

      </MapContainer>
    </div>
  );
}