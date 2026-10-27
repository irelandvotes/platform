"use client";

import { useState } from "react";
import type { NiAssemblyProjectionResult } from "@/lib/staff/niAssemblyProjection";
import type { NiAssemblyParty } from "@/lib/staff/niAssemblyProjectionData";
import type { SeatProjectionMapFeature } from "@/lib/staff/seatProjectionData";

type Props = {
  features: SeatProjectionMapFeature[];
  constituencies: NiAssemblyProjectionResult["constituencies"];
  parties: NiAssemblyParty[];
  onSelect: (constituency: string) => void;
};

export default function NiAssemblyProjectionMap({ features, constituencies, parties, onSelect }: Props) {
  const [activeName, setActiveName] = useState("");
  const byName = new Map(constituencies.map((constituency) => [constituency.name, constituency]));
  const partyByCode = new Map(parties.map((party) => [party.code, party]));
  const active = byName.get(activeName);
  const activeShareLeader = active?.parties.slice().sort((a, b) => b.firstPreferenceShare - a.firstPreferenceShare)[0];
  const activeLeaderParty = activeShareLeader ? partyByCode.get(activeShareLeader.code) : undefined;

  return (
    <div className="staff-projection-map-layout">
      <div className="staff-projection-map-wrap">
        <svg
          className="staff-projection-map"
          viewBox="0 0 420 520"
          role="img"
          aria-label="Northern Ireland Assembly constituencies shaded by the party with the highest simulated mean first-preference share"
        >
          {features.map((feature) => {
            const result = byName.get(feature.name);
            const shareLeader = result?.parties.slice().sort((a, b) => b.firstPreferenceShare - a.firstPreferenceShare)[0];
            const party = shareLeader ? partyByCode.get(shareLeader.code) : undefined;
            const resultLabel = result && shareLeader
              ? feature.name + ": " + (party?.name ?? shareLeader.code) + " leads mean first-preference share at " + shareLeader.firstPreferenceShare.toFixed(1) + "%"
              : feature.name + ": no projection";
            return (
              <path
                key={feature.name}
                d={feature.path}
                fill={party?.color ?? "#dbe2e4"}
                className={activeName === feature.name ? "is-selected" : ""}
                aria-label={resultLabel}
                role="button"
                tabIndex={0}
                onMouseEnter={() => setActiveName(feature.name)}
                onMouseLeave={() => setActiveName("")}
                onFocus={() => setActiveName(feature.name)}
                onBlur={() => setActiveName("")}
                onClick={() => { setActiveName(feature.name); onSelect(feature.name); }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setActiveName(feature.name);
                    onSelect(feature.name);
                  }
                }}
              >
                <title>{resultLabel}</title>
              </path>
            );
          })}
        </svg>
        <div className="staff-projection-map-legend">
          {parties.filter((party) => constituencies.some((seat) => (
            seat.parties.slice().sort((a, b) => b.firstPreferenceShare - a.firstPreferenceShare)[0]?.code === party.code
          ))).map((party) => (
            <span key={party.code}><i style={{ backgroundColor: party.color }} />{party.code}</span>
          ))}
        </div>
        <div className="staff-projection-map-tooltip" aria-live="polite" aria-atomic="true">
          {active ? (
            <>
              <div className="staff-projection-map-tooltip-title">
                <i style={{ backgroundColor: activeLeaderParty?.color ?? "#7a8589" }} />
                <strong>{active.name}</strong>
                <span>{activeShareLeader?.code ?? "—"}</span>
              </div>
              <div className="staff-projection-map-tooltip-stats">
                <span>Highest mean FP share <strong>{activeShareLeader?.firstPreferenceShare.toFixed(1) ?? "0.0"}%</strong></span>
                {active.parties.slice().sort((a, b) => b.firstPreferenceShare - a.firstPreferenceShare).slice(0, 3).map((result) => (
                  <span key={result.code}>{result.code} mean FP share <strong>{result.firstPreferenceShare.toFixed(1)}%</strong></span>
                ))}
              </div>
              <p className="staff-projection-map-hint">
                Mean seats: {active.parties.map((result) => result.code + " " + result.expectedSeats.toFixed(1)).join(" · ")}
              </p>
            </>
          ) : <span className="staff-projection-map-hint">Hover or focus a constituency to explore mean vote share</span>}
        </div>
      </div>
    </div>
  );
}
