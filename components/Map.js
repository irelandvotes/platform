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
  IFP: "#0b5a1c",
  INDIRL: "#9be736",
  IND: "#7a7a7a",
  IPP: "#0e9775"
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
        map.setView([53.5, -8], 7.25);
        onReset?.();
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

function ResetOnTrigger({ resetTrigger }) {
  const map = useMap();

  useEffect(() => {
    if (!resetTrigger) return;

    map.setView([53.5, -8], 7.25);
  }, [resetTrigger, map]);

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
  resetTrigger,
  results,
  count,
  onLoadPreviousResults
}) {
  const [geoData, setGeoData] = useState(null);
  const geoJsonRef = useRef();
  const mapRef = useRef(null);
  const [previousResults, setPreviousResults] = useState([]);
  const [containerWidth, setContainerWidth] = useState(0);

  const country = election?.country || "ireland";
  const type = election?.type || "dail";
  const year = election?.year || "2024";

  const dataPath = `/data/elections/${country}/${type}/${year}`;

const [isDark, setIsDark] = useState(true);

useEffect(() => {
  if (!containerRef.current) return;

  const updateSize = () => {
    setContainerWidth(containerRef.current.offsetWidth);
  };

  updateSize();

  const observer = new ResizeObserver(updateSize);
  observer.observe(containerRef.current);

  return () => observer.disconnect();
}, []);

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

      window.seatMap = seatMap;

      setGeoData(data);
    });
}, [dataPath]);


  /* =============================
     Load Election CSV Data
  ============================= */

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
            name,
            party: row.party,
            votes: Number(row.votes) || 0,
            status: row.status?.toLowerCase() || "running",
            incumbent: row.incumbent === "TRUE",
            seats: Number(row.seats),
            quota: Number(row.quota),
            electorate: Number(row.electorate),
            turnout: Number(row.turnout),
            tvp: Number(row.tvp),
            spoilt: Number(row.spoilt),
          });
        });

        console.log("GROUPED:", grouped);

        window.results = grouped;

Object.entries(window.seatMap || {}).forEach(
  ([constituency, seats]) => {

    if (!grouped[constituency]) {
      grouped[constituency] = {
        counts: {},
        seats
      };
    } else {
      grouped[constituency].seats =
        grouped[constituency].seats || seats;
    }

  }
);

Object.entries(seatMap).forEach(([c, seats]) => {
  if (!grouped[c]) {
    grouped[c] = {
      counts: {},
      seats
    };
  } else {
    grouped[c].seats = seats;
  }
});

        onLoadResults(grouped);
        onLoadList(Object.keys(grouped));
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
    spoiltMax: Math.max(...spoilt)
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

  if (view === "party") {
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
      getTooltip(key, results, view, ranges),
      {
        sticky: true,
        direction: "top",
        opacity: 0.95,
        className: "map-tooltip"
      }
    );
  });

}, [view, results]);

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

function getColor(name) {
  const constituency = results?.[name];
  if (!constituency?.counts) return "transparent";

  const counts = constituency.counts;

  // NATIONAL VIEW
  if (!selected) {

    // Largest Party
    if (view === "party") {
      const first = counts[1];
      if (!first?.length) return "transparent";

      const partyTotals = {};

      first.forEach((c) => {
        partyTotals[c.party] =
          (partyTotals[c.party] || 0) + c.votes;
      });

      const winner = Object.entries(partyTotals)
        .sort((a, b) => b[1] - a[1])[0];

      return PARTY_COLORS[winner?.[0]] || "transparent";
    }

    // Poll-topping candidate
    if (view === "count") {
      const first = counts[1];
      if (!first?.length) return "transparent";

      const leader = [...first]
        .sort((a, b) => b.votes - a.votes)[0];

      return PARTY_COLORS[leader?.party] || "transparent";
    }

// Turnout
if (view === "turnout") {
  const first = counts[1]?.[0];
  if (!first) return "transparent";

  const percent =
    first.turnout / first.electorate;

  return getGreyScale(
    percent,
    ranges.turnoutMin,
    ranges.turnoutMax
  );
}

// Spoilt
if (view === "spoilt") {
  const first = counts[1]?.[0];
  if (!first) return "transparent";

  const percent =
    first.spoilt / first.turnout;

  return getGreyScale(
    percent,
    ranges.spoiltMin,
    ranges.spoiltMax
  );
}

  }

  // CONSTITUENCY VIEW

  if (view === "party") {
    const first = counts[1];
    if (!first?.length) return "transparent";

    const partyTotals = {};

    first.forEach((c) => {
      partyTotals[c.party] =
        (partyTotals[c.party] || 0) + c.votes;
    });

    const winner = Object.entries(partyTotals)
      .sort((a, b) => b[1] - a[1])[0];

    return PARTY_COLORS[winner?.[0]] || "transparent";
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

// 👇 ADD THIS EXACTLY HERE
let dynamicZoom = 6.5;

if (containerWidth < 500) dynamicZoom = 6.0;
else if (containerWidth < 700) dynamicZoom = 6.2;
else dynamicZoom = 6.5;

  /* =============================
     Map Render
  ============================= */

const containerRef = useRef(null);

return (
  <div
    ref={containerRef}
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

    setTimeout(() => {
      map.invalidateSize();
    }, 0);
  }}
  center={[53.5, -8]}
  zoom={dynamicZoom}
  minZoom={dynamicZoom}
  zoomControl={false}
  maxBounds={[
    [51.2, -11.5],  // Southwest Ireland
    [55.8, -5.0]    // Northeast Ireland
  ]}
  maxBoundsViscosity={1.0}
  style={{
    height: "100%",
    width: "100%",
    background: isDark ? "#1f1f1f" : "#f8f8f8"
  }}
  scrollWheelZoom
  onClick={() => onSelect(null)}
>

        <ResetOnTrigger resetTrigger={resetTrigger} />

<ZoomControls />

        {/* Reset Button */}
        <ResetButton
          geoJsonRef={geoJsonRef}
          onReset={() => onSelect(null)}
        />

        {/* Zoom Handler */}
        <ZoomToSelected
          selected={selected}
          geoJsonRef={geoJsonRef}
          resetTrigger={resetTrigger}
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

{/* LEFT FADE GRADIENT */}
<div
style={{
position: "absolute",
top: 0,
bottom: 0,
left: 0,
width: "120px",
background: "linear-gradient(to right, var(--panel) 0%, rgba(0,0,0,0) 100%)",
pointerEvents: "none",
zIndex: 500
}}
/>

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
    const layer = e.target;

    const key = cleanName(
      layer.feature.properties.ENG_NAME_VALUE
    );

    const isSelected = selected?.name === key;

    if (!isSelected) {
layer.setStyle({
  weight: 2,
  color: "var(--map-outline-hover)",
  fillOpacity: isDark ? 0.75 : 0.65
});
    }
  },

mouseout: (e) => {
  const layer = e.target;

  const key = cleanName(
    layer.feature.properties.ENG_NAME_VALUE
  );

  const isSelected = selected?.name === key;

  if (!isSelected) {

    const color = getColor(key);

    layer.setStyle({
      color: isSelected
        ? "var(--map-outline-selected)"
        : "var(--map-outline)",
      weight: isSelected ? 4 : 1,
      fillColor: color,
      fillOpacity:
        color === "transparent"
          ? 0
          : isSelected ? 1 : 0.5
    });

  }
},

  click: (e) => {
    e.originalEvent.stopPropagation();

    setTimeout(() => {
      onSelect({
        name: key,
        data: undefined,
      });
    }, 100);
  },
});
}}
          />
        )}

      </MapContainer>
    </div>
  );
}