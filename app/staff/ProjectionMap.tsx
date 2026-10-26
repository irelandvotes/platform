"use client";

import { useState } from "react";
import type { SeatProjectionMapFeature, SeatProjectionParty } from "@/lib/staff/seatProjectionData";

type MapSeat = {
  name: string;
  winner: string;
  runnerUp: string;
  margin: number;
  winProbability: Record<string, number>;
};

export default function ProjectionMap({
  features,
  constituencies,
  parties,
}: {
  features: SeatProjectionMapFeature[];
  constituencies: MapSeat[];
  parties: SeatProjectionParty[];
}) {
  const [hoveredName, setHoveredName] = useState("");
  const [selectedName, setSelectedName] = useState("");
  const byName = new Map(constituencies.map((constituency) => [constituency.name, constituency]));
  const partyByCode = new Map(parties.map((party) => [party.code, party]));
  const activeName = hoveredName || selectedName;
  const active = byName.get(activeName);
  const activeWinner = active ? partyByCode.get(active.winner) : undefined;

  return (
    <div className="staff-projection-map-layout">
      <div className="staff-projection-map-wrap">
        <svg className="staff-projection-map" viewBox="0 0 420 520" role="img" aria-label="Map of projected Northern Ireland Westminster constituency winners">
          {features.map((feature) => {
            const seat = byName.get(feature.name);
            const party = seat ? partyByCode.get(seat.winner) : undefined;
            return (
              <path
                key={feature.name}
                d={feature.path}
                fill={party?.color ?? "#dbe2e4"}
                className={activeName === feature.name ? "is-selected" : ""}
                aria-label={`${feature.name}: ${party?.name ?? "No projection"}, ${seat ? (seat.winProbability[seat.winner] ?? 0).toFixed(1) : "0.0"}% estimated win chance`}
                role="button"
                tabIndex={0}
                onMouseEnter={() => setHoveredName(feature.name)}
                onMouseLeave={() => setHoveredName("")}
                onFocus={() => setHoveredName(feature.name)}
                onBlur={() => setHoveredName("")}
                onClick={() => setSelectedName(feature.name)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedName(feature.name);
                  }
                }}
              >
                <title>{feature.name}: {party?.name ?? "No projection"}{seat ? ` · ${(seat.winProbability[seat.winner] ?? 0).toFixed(1)}% win chance` : ""}</title>
              </path>
            );
          })}
        </svg>
        <div className="staff-projection-map-legend">
          {parties.filter((party) => constituencies.some((seat) => seat.winner === party.code)).map((party) => (
            <span key={party.code}><i style={{ backgroundColor: party.color }} />{party.code}</span>
          ))}
        </div>
        <div className="staff-projection-map-tooltip" aria-live="polite" aria-atomic="true">
          {active ? (
            <>
              <div className="staff-projection-map-tooltip-title"><i style={{ backgroundColor: activeWinner?.color ?? "#7a8589" }} /><strong>{active.name}</strong><span>{active.winner}</span></div>
              <div className="staff-projection-map-tooltip-stats"><span>Win chance <strong>{(active.winProbability[active.winner] ?? 0).toFixed(1)}%</strong></span><span>Lead <strong>{active.margin.toFixed(1)} pts</strong></span><span>Runner-up <strong>{active.runnerUp}</strong></span></div>
            </>
          ) : <span className="staff-projection-map-hint">Hover or focus a constituency to explore the projection</span>}
        </div>
      </div>
    </div>
  );
}
