"use client";

import { useState } from "react";
import type { SeatProjectionMapFeature, SeatProjectionParty } from "@/lib/staff/seatProjectionData";

type MapSeat = {
  name: string;
  winner: string;
  runnerUp: string;
  margin: number;
  winProbability: Record<string, number>;
  projected: Array<{ code: string; share: number }>;
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
  const leadingShare = (seat: MapSeat) => seat.projected.filter((party) => party.share > 0).sort((a, b) => b.share - a.share)[0];
  const activeLeader = active ? leadingShare(active) : undefined;
  const activeLeaderParty = activeLeader ? partyByCode.get(activeLeader.code) : undefined;

  return (
    <div className="staff-projection-map-layout">
      <div className="staff-projection-map-wrap">
        <svg className="staff-projection-map" viewBox="0 0 420 520" role="img" aria-label="Map of Northern Ireland constituencies shaded by the party with the highest mean projected vote share">
          {features.map((feature) => {
            const seat = byName.get(feature.name);
            const leader = seat ? leadingShare(seat) : undefined;
            const party = leader ? partyByCode.get(leader.code) : undefined;
            return (
              <path
                key={feature.name}
                d={feature.path}
                fill={party?.color ?? "#dbe2e4"}
                className={activeName === feature.name ? "is-selected" : ""}
                aria-label={`${feature.name}: highest mean vote share ${party?.name ?? "no projection"}${leader ? ` at ${leader.share.toFixed(1)}%` : ""}`}
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
                <title>{feature.name}: {party?.name ?? "No projection"}{leader ? ` · ${leader.share.toFixed(1)}% mean share` : ""}</title>
              </path>
            );
          })}
        </svg>
        <div className="staff-projection-map-legend">
          {parties.filter((party) => constituencies.some((seat) => leadingShare(seat)?.code === party.code)).map((party) => (
            <span key={party.code}><i style={{ backgroundColor: party.color }} />{party.code}</span>
          ))}
        </div>
        <div className="staff-projection-map-tooltip" aria-live="polite" aria-atomic="true">
          {active ? (
            <>
              <div className="staff-projection-map-tooltip-title"><i style={{ backgroundColor: activeLeaderParty?.color ?? "#7a8589" }} /><strong>{active.name}</strong><span>{activeLeader?.code ?? "—"}</span></div>
              <div className="staff-projection-map-tooltip-stats"><span>Mean share <strong>{activeLeader?.share.toFixed(1) ?? "0.0"}%</strong></span><span>Win chance <strong>{activeLeader ? (active.winProbability[activeLeader.code] ?? 0).toFixed(1) : "0.0"}%</strong></span><span>Next highest <strong>{active.projected.filter((item) => item.code !== activeLeader?.code).sort((a, b) => b.share - a.share)[0]?.code ?? "—"}</strong></span></div>
            </>
          ) : <span className="staff-projection-map-hint">Hover or focus a constituency to explore the projection</span>}
        </div>
      </div>
    </div>
  );
}
