"use client";

import { useMemo, useState } from "react";
import ProjectionModelSwitcher from "./ProjectionModelSwitcher";
import NiAssemblyProjectionMap from "./NiAssemblyProjectionMap";
import { runNiAssemblyProjection, type NiAssemblyProjectionResult, type NiAssemblySettings } from "@/lib/staff/niAssemblyProjection";
import type { NiAssemblyProjectionData } from "@/lib/staff/niAssemblyProjectionData";

type Props = { data: NiAssemblyProjectionData };
const ITERATIONS = 10_000;
const PROJECTION_MODEL_REVISION = "candidate-probability-top-five-mean-count-sparse-history-v5";

function defaultCandidateCounts(data: NiAssemblyProjectionData) {
  return Object.fromEntries(data.constituencies.map((constituency) => {
    const counts = constituency.candidates.reduce<Record<string, number>>((result, candidate) => {
      result[candidate.party] = (result[candidate.party] ?? 0) + 1;
      return result;
    }, {});
    return [constituency.name, counts];
  }));
}

function formatSeats(value: number) {
  return String(Math.round(value));
}

function textColorForPartyColor(color: string) {
  const hex = color.replace("#", "");
  if (!/^[\da-f]{6}$/i.test(hex)) return "#172326";
  const channels = [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const luminance = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
  return luminance > 0.42 ? "#172326" : "#ffffff";
}

export default function NiAssemblyProjectionWorkspace({ data }: Props) {
  const [support, setSupport] = useState(() => Object.fromEntries(data.parties.map((party) => [party.code, party.baselineShare.toFixed(1)])));
  const [candidateCounts, setCandidateCounts] = useState(() => defaultCandidateCounts(data));
  const [pollingUncertainty, setPollingUncertainty] = useState(2);
  const [localVariation, setLocalVariation] = useState(2);
  const [selectedCandidateConstituency, setSelectedCandidateConstituency] = useState(data.constituencies[0]?.name ?? "");
  const [selectedConstituency, setSelectedConstituency] = useState("all");
  const [projection, setProjection] = useState<NiAssemblyProjectionResult | null>(null);
  const [appliedSignature, setAppliedSignature] = useState("");
  const [isRunning, setIsRunning] = useState(false);

  const draftSettings = useMemo<NiAssemblySettings>(() => ({
    support: Object.fromEntries(data.parties.map((party) => [party.code, Math.max(0, Number(support[party.code]) || 0)])),
    candidateCounts,
    pollingUncertainty,
    localVariation,
    iterations: ITERATIONS,
  }), [data.parties, support, candidateCounts, pollingUncertainty, localVariation]);
  const draftSignature = `${PROJECTION_MODEL_REVISION}:${JSON.stringify(draftSettings)}`;
  const hasChanges = projection === null || appliedSignature !== draftSignature;
  const rangeAxisMaximum = projection
    ? Math.max(5, Math.ceil(Math.max(...projection.standings.flatMap((party) => [party.highSeats, party.baselineSeats])) * 1.12 / 5) * 5)
    : data.seats;
  const selectedData = data.constituencies.find((constituency) => constituency.name === selectedCandidateConstituency);
  const transferAuditRows = [
    { eventType: "surplus", partyProfiles: data.transfers.surplus, blocProfiles: data.transfers.surplusByBloc },
    { eventType: "elimination", partyProfiles: data.transfers.elimination, blocProfiles: data.transfers.eliminationByBloc },
  ].flatMap(({ eventType, partyProfiles, blocProfiles }) => [
    ...Object.values(partyProfiles).map((profile) => ({ eventType, profile, scope: "Party profile" })),
    ...Object.values(blocProfiles).map((profile) => ({ eventType, profile, scope: "Bloc fallback" })),
  ]).sort((a, b) => a.eventType.localeCompare(b.eventType) || a.scope.localeCompare(b.scope) || b.profile.eventCount - a.profile.eventCount || a.profile.sourceParty.localeCompare(b.profile.sourceParty));
  const enteredTotal = Object.values(draftSettings.support).reduce((sum, value) => sum + value, 0);
  function runProjection() {
    setIsRunning(true);
    window.setTimeout(() => {
      const result = runNiAssemblyProjection(data, draftSettings);
      setProjection(result);
      setAppliedSignature(draftSignature);
      setIsRunning(false);
    }, 20);
  }

  function resetBaseline() {
    setSupport(Object.fromEntries(data.parties.map((party) => [party.code, party.baselineShare.toFixed(1)])));
    setCandidateCounts(defaultCandidateCounts(data));
    setPollingUncertainty(2);
    setLocalVariation(2);
    setProjection(null);
    setAppliedSignature("");
  }

  return (
    <main className="staff-home-content staff-projection-page staff-nia-page">
      <section className="staff-projection-toolbar" aria-label="Projection model toolbar">
        <div className="staff-projection-topbar">
          <div className="staff-projection-toolbar-tile staff-projection-toolbar-title">
            <p className="staff-eyebrow">ELECTORAL MODELLING</p>
            <h1>Seat projection</h1>
            <ProjectionModelSwitcher current="nia" enabled={["hoc", "nia"]} />
          </div>
          <div className="staff-projection-toolbar-tile staff-projection-toolbar-constituencies">
            <span className="staff-projection-toolbar-label">Constituencies</span><strong>{data.constituencies.length}</strong><small>NI-wide</small>
          </div>
          <div className="staff-projection-toolbar-tile staff-projection-toolbar-seats">
            <span className="staff-projection-toolbar-label">Seats</span><strong>{data.seats}</strong><small>5 per area</small>
          </div>
          <div className="staff-projection-toolbar-tile staff-projection-toolbar-detail">
            <span className="staff-projection-toolbar-label">Baseline & geography</span><strong>NI Assembly 2022</strong><small>2024 HOC boundaries + local signal</small>
          </div>
          <div className="staff-projection-toolbar-tile staff-projection-toolbar-detail">
            <span className="staff-projection-toolbar-label">Method</span><strong>Party quota simulation</strong><small>Droop quotas · transfers</small>
          </div>
          <div className="staff-projection-actions staff-projection-toolbar-actions">
            <button type="button" className="staff-projection-run-button staff-projection-toolbar-action-button" onClick={runProjection} disabled={isRunning || !hasChanges}>
              <span className="staff-projection-toolbar-label">Scenario</span>
              <span className="staff-nia-action-main"><svg className="staff-projection-action-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10a6 6 0 0 1 10.2-4.2L16 7.5M16 4v3.5h-3.5M16 10a6 6 0 0 1-10.2 4.2L4 12.5M4 16v-3.5h3.5" /></svg>{isRunning ? "Running model…" : projection ? "Update projection" : "Run projection"}</span>
              <small>{hasChanges ? "Inputs changed" : "Results up to date"}</small>
            </button>
            <button type="button" className="staff-projection-reset staff-projection-toolbar-action-button" onClick={resetBaseline}>
              <span className="staff-projection-toolbar-label">Inputs</span>
              <span className="staff-nia-action-main"><svg className="staff-projection-action-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M4.5 7.5A6 6 0 1 1 4 11M4.5 3.8v3.8h3.8" /></svg>Reset baseline</span><small>Restore 2022 inputs</small>
            </button>
          </div>
        </div>
      </section>

      <div className="staff-projection-layout staff-nia-layout">
        <aside className="staff-nia-controls">
          <section className="staff-projection-input-card">
            <div className="staff-projection-section-heading"><div><p className="staff-eyebrow">SCENARIO INPUT</p><h2>NI-wide first preferences</h2></div></div>
            <p className="staff-projection-help">Start from the 2022 NI-wide Assembly result. Enter a new vote-share scenario; values are normalized within the model when they do not total 100%.</p>
            <div className="staff-projection-party-inputs">
              {data.parties.map((party) => (
                <label key={party.code} className="staff-projection-party-input">
                  <span className="staff-projection-party-name"><i style={{ backgroundColor: party.color }} />{party.name}<small>{party.code}</small></span>
                  <span className="staff-projection-number-wrap"><input type="number" min="0" max="100" step="0.1" value={support[party.code] ?? "0"} onChange={(event) => setSupport((current) => ({ ...current, [party.code]: event.target.value }))} aria-label={`${party.name} NI-wide first preference share`} /><span>%</span></span>
                </label>
              ))}
            </div>
            <div className={`staff-projection-total${Math.abs(enteredTotal - 100) > 0.05 ? " is-outside" : ""}`}><span>Entered total</span><strong>{enteredTotal.toFixed(1)}%</strong></div>
            <p className="staff-projection-help">Historical bloc strength and party performance within each bloc convert NI-wide support into local party shares. The model then applies constituency quotas and transfers.</p>
            <div className="staff-projection-uncertainty">
              <div className="staff-projection-uncertainty-heading"><strong>Simulation assumptions</strong><span>Provisional</span></div>
              <label><span>National polling uncertainty <strong>{pollingUncertainty.toFixed(1)} pts</strong></span><input type="range" min="0" max="8" step="0.5" value={pollingUncertainty} onChange={(event) => setPollingUncertainty(Number(event.target.value))} /></label>
              <label><span>Local variation <strong>{localVariation.toFixed(1)} pts</strong></span><input type="range" min="0" max="8" step="0.5" value={localVariation} onChange={(event) => setLocalVariation(Number(event.target.value))} /></label>
              <p>{ITERATIONS.toLocaleString()} simulated counts per constituency. Results are scenario estimates, not calibrated probabilities.</p>
            </div>
          </section>

          <section className="staff-projection-input-card staff-nia-slate-card">
            <div className="staff-projection-section-heading"><div><p className="staff-eyebrow">CANDIDATE SLATE</p><h2>Constituency candidates</h2></div></div>
            <label className="staff-projection-mode-picker staff-nia-constituency-picker"><span className="staff-projection-toolbar-label">Constituency</span><select value={selectedCandidateConstituency} onChange={(event) => setSelectedCandidateConstituency(event.target.value)}>{data.constituencies.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select></label>
            <p className="staff-projection-help">Set how many candidates each party is expected to run. Counts default to the 2022 slate and cap its possible seats. Party first preferences are split across generic candidate slots using the historical within-party distribution where available.</p>
            <div className="staff-nia-candidate-counts">
              {data.parties.map((party) => (
                <label key={party.code}><span><i style={{ backgroundColor: party.color }} />{party.code}</span><select value={candidateCounts[selectedCandidateConstituency]?.[party.code] ?? 0} disabled={(candidateCounts[selectedCandidateConstituency]?.[party.code] ?? 0) > 0 && Object.values(candidateCounts[selectedCandidateConstituency] ?? {}).reduce((sum, count) => sum + count, 0) <= (candidateCounts[selectedCandidateConstituency]?.[party.code] ?? 0)} onChange={(event) => setCandidateCounts((current) => ({ ...current, [selectedCandidateConstituency]: { ...current[selectedCandidateConstituency], [party.code]: Number(event.target.value) } }))} aria-label={`${party.name} candidates in ${selectedCandidateConstituency}`}>
                  {[0, 1, 2, 3, 4, 5, 6].map((count) => <option key={count} value={count}>{count === 0 ? "Not running" : `${count} candidate${count === 1 ? "" : "s"}`}</option>)}
                </select></label>
              ))}
            </div>
          </section>
        </aside>

        <section className="staff-projection-results staff-nia-results">
          {projection && hasChanges && <p className="staff-projection-pending-note" role="status">Showing the last run. Press <strong>Update projection</strong> to apply your draft settings.</p>}
          {projection && <>
            <section className="staff-projection-result-card staff-projection-standings-card staff-nia-standings-card" aria-labelledby="nia-seats-heading">
              <div className="staff-projection-section-heading">
                  <div><p className="staff-eyebrow">NI-WIDE RESULT</p><h2 id="nia-seats-heading">Top-five constituency projection</h2></div>
              </div>
              <div className="staff-projection-standings">
                {projection.standings.filter((row) => row.topFiveSeats > 0 || row.baselineSeats > 0).map((row) => {
                  const party = data.parties.find((item) => item.code === row.code)!;
                  return <div className="staff-projection-standing" key={row.code} style={{ backgroundColor: `color-mix(in srgb, ${party.color} 10%, white)`, borderLeftColor: party.color }}>
                    <div className="staff-projection-standing-label"><strong>{party.name}</strong></div>
                    <div className="staff-projection-standing-metrics">
                      <div className="staff-projection-standing-seatmetric"><strong style={{ backgroundColor: party.color, color: textColorForPartyColor(party.color) }}>{row.topFiveSeats}</strong><small>Seats</small></div>
                      <div className="staff-projection-standing-votemetric"><strong>{Number(support[row.code] ?? 0).toFixed(1)}%</strong><small>FPV</small></div>
                    </div>
                  </div>;
                })}
              </div>
            </section>

            <section className="staff-projection-result-card staff-nia-map-card" aria-labelledby="nia-map-heading">
              <div className="staff-projection-section-heading"><div><p className="staff-eyebrow">GEOGRAPHIC VIEW</p><h2 id="nia-map-heading">Mean vote-share leaders</h2></div><span>Party with highest simulated mean first-preference share</span></div>
              <NiAssemblyProjectionMap features={data.mapFeatures} constituencies={projection.constituencies} parties={data.parties} onSelect={setSelectedConstituency} />
            </section>

            <section className="staff-projection-result-card staff-nia-range-card" aria-labelledby="nia-range-heading">
              <div className="staff-projection-section-heading"><div><p className="staff-eyebrow">SIMULATION</p><h2 id="nia-range-heading">Seat outcomes across {projection.iterations.toLocaleString()} runs</h2></div><span>Middle 80% range</span></div>
              <div className="staff-projection-range-legend"><span><i className="is-range" />Middle 80% of runs</span><span><i className="is-median" />Median</span><span><i className="is-baseline" />2022 result</span></div>
              <div className="staff-projection-range-axis"><span>0 seats</span><span>{rangeAxisMaximum} seats</span></div>
              <div className="staff-projection-range-list">{projection.standings.filter((row) => row.expectedSeats > 0.01 || row.baselineSeats > 0).map((row) => {
                const party = data.parties.find((item) => item.code === row.code)!;
                return <div className="staff-projection-range-row staff-nia-range-row" key={row.code} role="img" aria-label={`${party.name}: median ${row.medianSeats} seats, middle 80 percent range ${row.lowSeats} to ${row.highSeats}, 2022 baseline ${row.baselineSeats}, ${row.largestPartyProbability.toFixed(1)} percent chance of most seats`}>
                  <span className="staff-projection-range-name"><i style={{ backgroundColor: party.color }} />{party.code}</span>
                  <span className="staff-projection-range-track"><i className="staff-projection-range-baseline" style={{ left: `${row.baselineSeats / rangeAxisMaximum * 100}%` }} /><i className="staff-projection-range-band" style={{ left: `${row.lowSeats / rangeAxisMaximum * 100}%`, width: `${Math.max(0.4, (row.highSeats - row.lowSeats) / rangeAxisMaximum * 100)}%`, backgroundColor: party.color }} /><i className="staff-projection-range-median" style={{ left: `${row.medianSeats / rangeAxisMaximum * 100}%`, borderColor: party.color }} /></span>
                  <span className="staff-projection-range-value">{row.medianSeats}<small> ({row.lowSeats}–{row.highSeats})</small></span>
                  <span className="staff-projection-leader-chance">{row.largestPartyProbability.toFixed(1)}% most seats</span>
                </div>;
              })}</div>
            </section>
          </>}

          <section className="staff-projection-result-card staff-nia-constituency-results" aria-labelledby="nia-constituencies-heading">
            <div className="staff-projection-section-heading">
              <div><p className="staff-eyebrow">CONSTITUENCY DETAIL</p><h2 id="nia-constituencies-heading">Projected outcomes</h2></div>
              <label className="staff-projection-constituency-picker"><span>View</span><select aria-label="Choose Assembly constituency view" value={selectedConstituency} onChange={(event) => setSelectedConstituency(event.target.value)}>
                <option value="all">All constituencies</option>{data.constituencies.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
              </select></label>
            </div>
            {!projection ? <div className="staff-nia-empty"><strong>Projection not run</strong><span>Run the model to see constituency win probabilities, vote-share ranges and STV results.</span></div> : (
              <div className={`staff-projection-constituency-list${selectedConstituency === "all" ? " is-all" : " is-single"}`}>
                {projection.constituencies.map((constituency) => {
                  if (selectedConstituency !== "all" && selectedConstituency !== constituency.name) return null;
                  const leaderParty = data.parties.find((party) => party.code === constituency.leadingParty);
                  const candidateRankings = constituency.parties.flatMap((partyResult) => partyResult.candidates.map((candidate) => ({
                    partyResult,
                    party: data.parties.find((item) => item.code === partyResult.code)!,
                    candidate,
                    probability: candidate.electionProbability,
                    key: `${partyResult.code}-${candidate.name}`,
                  }))).sort((a, b) => b.probability - a.probability || a.party.code.localeCompare(b.party.code) || a.candidate.name.localeCompare(b.candidate.name));
                  const topFiveCandidates = candidateRankings.slice(0, constituency.seats);
                  const topFivePartyOrder = [...new Set(topFiveCandidates.map(({ party }) => party.code))];
                  const topFivePartyGroups = topFivePartyOrder.map((code) => ({
                    party: data.parties.find((item) => item.code === code)!,
                    candidates: topFiveCandidates.filter((candidate) => candidate.party.code === code),
                  }));
                  const candidateRows = constituency.parties.flatMap((partyResult) => partyResult.candidates.map((candidate) => ({ ...candidate, partyCode: partyResult.code })))
                    .sort((a, b) => a.partyCode.localeCompare(b.partyCode) || a.name.localeCompare(b.name));
                  return <article className="staff-projection-constituency staff-nia-constituency" key={constituency.name}>
                    <button type="button" className="staff-projection-constituency-summary staff-nia-constituency-summary" onClick={() => setSelectedConstituency((current) => current === constituency.name ? "all" : constituency.name)} aria-expanded={selectedConstituency === constituency.name}>
                      <span className="staff-projection-constituency-name"><strong>{constituency.name}</strong><small>{constituency.seats} seats · Droop quota {constituency.quota.toLocaleString()}</small></span>
                      <span className="staff-projection-winner"><span><i style={{ backgroundColor: leaderParty?.color ?? "#7a8589" }} />{constituency.leadingParty || "—"}</span><strong>{(constituency.leadingPartyProbability[constituency.leadingParty] ?? 0).toFixed(1)}%<small>chance to lead</small></strong></span>
                      <span className="staff-nia-constituency-topline">{topFivePartyGroups.length ? `Top five: ${topFivePartyGroups.map(({ party, candidates }) => `${party.code} ${candidates.length}`).join(" | ")}` : "No projected candidates"}</span>
                      <span className="staff-projection-win-bar staff-nia-topfive-bar" role="img" aria-label={`Top-five candidate picks grouped by party: ${topFivePartyGroups.map(({ party, candidates }) => `${party.name} ${candidates.length}`).join(", ")}`}>
  {topFivePartyGroups.flatMap(({ party, candidates }) => candidates.map((candidate, index) => <i key={`${party.code}-${candidate.candidate.name}`} title={`${party.name} - ${candidate.candidate.name}: seat ${index + 1} in its party group; ${candidate.probability.toFixed(1)}% election probability`} style={{ backgroundColor: party.color }} />))}
</span>
                    </button>
                    {selectedConstituency === constituency.name && <div className="staff-projection-constituency-detail">
                      <section className="staff-nia-party-share" aria-label="Projected party vote shares">
                        <h3>Projected party first-preference share</h3>
                        <p>Mean share across all {projection.iterations.toLocaleString()} simulations; the range shows the middle 80% of simulated outcomes.</p>
                        <div className="staff-nia-party-share-grid">
                          {[...constituency.parties].sort((a, b) => b.firstPreferenceShare - a.firstPreferenceShare).map((partyResult) => {
                            const party = data.parties.find((item) => item.code === partyResult.code);
                            return <div className="staff-nia-party-share-row" key={partyResult.code}>
                              <span className="staff-nia-party-share-label"><i style={{ backgroundColor: party?.color ?? "#7a8589" }} /><strong>{partyResult.code}</strong><small>{party?.name ?? partyResult.code}</small></span>
                              <strong className="staff-nia-party-share-mean">{partyResult.firstPreferenceShare.toFixed(1)}%</strong>
                              <small className="staff-nia-party-share-range">80% range {partyResult.firstPreferenceLow.toFixed(1)}–{partyResult.firstPreferenceHigh.toFixed(1)}%</small>
                              <i className="staff-nia-party-share-bar"><b style={{ width: `${Math.max(0, Math.min(100, partyResult.firstPreferenceShare))}%`, backgroundColor: party?.color ?? "#7a8589" }} /></i>
                            </div>;
                          })}
                        </div>
                      </section>
                      <p className="staff-projection-help">Candidates are ranked by their simulated probability of election. Candidate first-preference estimates below show how each party's projected vote is split across its candidate slate.</p>
<ol className="staff-nia-seat-chance-list" aria-label="Candidates ranked by probability of election">
  {candidateRankings.map(({ partyResult, party, candidate, probability, key }, rank) => <li className="staff-nia-seat-chance-item is-candidate" key={key}>
    <span className="staff-nia-seat-chance-rank">{rank + 1}</span>
    <span className="staff-nia-seat-chance-party"><i style={{ backgroundColor: party.color }} /><strong>{candidate.name}</strong><small>{party.code} - {party.name}</small></span>
    <span className="staff-nia-seat-chance-label">Chance of election</span>
    <span className="staff-nia-seat-chance-share">{Math.round(candidate.meanFirstPreferences).toLocaleString()} candidate FP <small>({(candidate.meanFirstPreferences / constituency.validVotes * 100).toFixed(1)}%)</small></span>
    <span className="staff-nia-seat-chance-value"><strong>{probability.toFixed(1)}%</strong><i><b style={{ width: probability + "%", backgroundColor: party.color }} /></i></span>
  </li>)}
</ol>
<section className="staff-nia-candidate-audit" aria-label="Illustrative STV count">
  <h3>Illustrative STV count - every count shown</h3>
  <p>Each cell gives the mean candidate tally across the simulated paths that reached that count number. Because the order of eliminations and elections varies between simulations, each heading shows the most common event at that count and how often it occurred. Count 1 is the mean first-preference vote total across all simulations.</p>
  <div className="staff-nia-count-audit-wrap">
    <table className="staff-nia-count-audit">
      <thead><tr><th className="staff-nia-count-candidate">Candidate</th>{constituency.meanCount.map((stage) => <th key={stage.count}><span>Count {stage.count} · mean</span><small>{stage.action === "first preferences" ? "First preferences" : `Most common: ${stage.action} ${stage.candidate} (${stage.eventFrequencyPercent.toFixed(0)}%)`}</small><small>{stage.transferred.toLocaleString(undefined, { maximumFractionDigits: 1 })} transferred for modal event</small><small>{stage.exhausted.toLocaleString(undefined, { maximumFractionDigits: 1 })} exhausted for modal event</small><small>{stage.simulationCount.toLocaleString()} paths</small></th>)}</tr></thead>
      <tbody>{candidateRows.map((candidate) => {
        const party = data.parties.find((item) => item.code === candidate.partyCode);
        return <tr key={candidate.name}>
          <th className="staff-nia-count-candidate"><i style={{ backgroundColor: party?.color ?? "#7a8589" }} />{candidate.name}<small>{candidate.partyCode}</small></th>
          {constituency.meanCount.map((stage) => {
            const tally = stage.candidateTallies.find((item) => item.name === candidate.name);
            return <td key={stage.count} title={tally ? `Mean tally ${tally.votes.toLocaleString(undefined, { maximumFractionDigits: 1 })}; most common status ${tally.status}; based on ${stage.simulationCount.toLocaleString()} paths` : "Not in this count"}>
              {tally ? tally.votes.toLocaleString(undefined, { maximumFractionDigits: 1 }) : "-"}
            </td>;
          })}
        </tr>;
      })}</tbody>
    </table>
  </div>
</section>
                    </div>}
                  </article>;
                })}
              </div>
            )}
          </section>
        </section>
      </div>

      <details className="staff-nia-methodology">
        <summary>Method and data limitations</summary>
        <div><p>The map and constituency names use the 2024 House of Commons boundaries, including Belfast South and Mid Down. Assembly count history is sourced from the 2017 and 2022 elections, contested on earlier boundaries. Constituency Assembly history cannot be exactly reassigned to the new lines from aggregate returns, so the boundary change is represented by a proxy rather than a ward-level reallocation.</p><p>The model uses a bloc-first local adjustment. It estimates local-to-national strength ratios separately for Nationalist, Unionist and Non-aligned support, then estimates each party’s relative performance within its bloc. The weighted historical sources are 2024 House of Commons results (35%), 2022 Assembly results (45%) and 2017 Assembly results (20%). Missing party history in a cycle contributes a neutral ratio of 1.0 instead of rescaling the available cycles, so one sparse result cannot carry the full historical weight. In each simulation, entered NI-wide party support is grouped into blocs; local bloc ratios adjust those totals, then within-bloc party ratios distribute local bloc support among parties contesting the constituency. The 2024 Westminster result supplies a current-boundary signal, with limited weight because it used a different election and electoral system. National polling uncertainty uses a non-negative, mean-preserving distribution so clipping small party shares at zero does not raise their simulated average.</p><p>Each simulation splits each party’s projected first preferences among generic candidate slots, using the 2022 within-party first-preference shares where available. It then runs a candidate-level STV count using the Droop quota: candidates reaching quota are elected and transfer their surplus; otherwise the lowest candidate is eliminated and their votes are transferred. The candidate labels are generic (for example, SF Candidate 1), not historical candidate names. Party-level destination and retention profiles for transfers come from identifiable count transitions in the 2017 and 2022 Assembly returns. These profiles include observed gains by continuing candidates of the same party, but the transfer records are inferred from aggregate count changes rather than ballot-level preferences. Ambiguous and exhausted transfers remain a significant source of uncertainty.</p><p>Available Assembly data: {data.transferDiagnostics.events} usable transfer-source events across {data.transferDiagnostics.transitions} adjacent count transitions from {data.transferDiagnostics.years.join(" and ")}; {data.transferDiagnostics.unusableTransitions} transitions had zero or multiple identifiable transfer-source events and were excluded from transfer fitting. The candidate-level simulation has not yet been backtested against a held-out full election.</p></div>
      </details>
      <details className="staff-nia-methodology staff-nia-transfer-audit">
        <summary>Observed transfer profiles · 2017 and 2022</summary>
        <p>Profiles are pooled across both Assembly elections. A source party uses its own profile when available; otherwise it uses an empirical profile pooled from parties in the same bloc and count-event type. Transfer retention is weighted by votes available in each event; destination percentages describe the share of observed gains going to each party, before the simulation adjusts for which candidates remain in the count.</p>
        <div className="staff-nia-transfer-table-wrap"><table className="staff-nia-transfer-table"><thead><tr><th>Profile</th><th>Count event</th><th>Observed events</th><th>Votes transferred</th><th>Main destinations</th></tr></thead><tbody>{transferAuditRows.map(({ eventType, profile, scope }) => {
          const destinations = Object.entries(profile.destinations).sort((a, b) => b[1] - a[1]).slice(0, 3);
          return <tr key={`${eventType}-${scope}-${profile.sourceParty}`}><th>{scope === "Bloc fallback" ? `${profile.sourceParty} · fallback` : profile.sourceParty}</th><td>{eventType === "surplus" ? "Surplus" : "Elimination"}</td><td>{profile.eventCount}</td><td>{(profile.retention * 100).toFixed(1)}% <small>({Math.round(profile.transferredVotes).toLocaleString()} / {Math.round(profile.sourceVotes).toLocaleString()})</small></td><td>{destinations.map(([party, share]) => `${party} ${(share * 100).toFixed(1)}%`).join(" · ") || "No observed destinations"}</td></tr>;
        })}</tbody></table></div>
      </details>
    </main>
  );
}
