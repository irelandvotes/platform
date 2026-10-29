import { Fragment } from "react";
import { Document, Page, Path, Svg, Text, View } from "@react-pdf/renderer";
import type { NiAssemblyProjectionData } from "@/lib/staff/niAssemblyProjectionData";
import type { NiAssemblyProjectionResult, NiAssemblySettings } from "@/lib/staff/niAssemblyProjection";
import { PDF_COLORS as C, PDF_STYLES as S, PdfAcronymIndex, PdfChrome, PdfClosingPage, PdfConstituencyHeading, PdfContentsPage, PdfCoverPage, PdfDistributionChart, PdfFrontMatterChrome, PdfNoticePage, PdfSeatHeadlineFigures, PdfSeatRangePanel, PdfSectionDivider, PdfSectionIntro, PdfTable } from "./ProjectionPdfKit";

const pct = (value: number) => `${value.toFixed(1)}%`;
const signed = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(1)} pp`;
const blocColor: Record<string, string> = { Nationalist: "#14765f", Unionist: "#436fa8", "Non-aligned": "#d49b22" };
const outcomeText = (items: Array<{ outcome: number; probability: number }>) => items.filter((item) => item.probability >= 0.1).map((item) => `${item.outcome}: ${item.probability.toFixed(1)}%`).join("  |  ") || "No material probability";

export default function NiAssemblyProjectionPdf({ data, projection, logo, reportDate, settings }: {
  data: NiAssemblyProjectionData; projection: NiAssemblyProjectionResult; logo: string; reportDate: string; settings: NiAssemblySettings;
}) {
  const parties = new Map(data.parties.map((party) => [party.code, party]));
  const candidateSlateSummary = data.parties.map((party) => {
    const constituencyCount = data.constituencies.filter((area) => (settings.candidateCounts[area.name]?.[party.code] ?? 0) > 0).length;
    const candidateCount = data.constituencies.reduce((sum, area) => sum + (settings.candidateCounts[area.name]?.[party.code] ?? 0), 0);
    return candidateCount > 0 ? `${party.code}: ${candidateCount} candidates in ${constituencyCount} constituencies` : null;
  }).filter((value): value is string => value !== null).join("  /  ");
  const inputRows = [
    ["Election baseline", "NI Assembly 2022; 2022 constituency and candidate slate is the default selection baseline."],
    ["NI-wide party support", data.parties.filter((party) => Number(settings.support[party.code]) > 0).map((party) => `${party.code} ${Number(settings.support[party.code]).toFixed(1)}%`).join("  /  ") || "No positive party support entered."],
    ["Candidate slate", candidateSlateSummary || "No candidates selected."],
    ["Historical evidence", "Assembly 2022: 55%; Assembly 2017: 30%; House of Commons 2024: 15% as a current-boundary proxy."],
    ["Transfer evidence", `${data.transferDiagnostics.events} usable source events across ${data.transferDiagnostics.transitions} count transitions from ${data.transferDiagnostics.years.join(" and ")}.`],
    ["Simulation settings", `Polling uncertainty ${settings.pollingUncertainty.toFixed(1)} points; local variation ${settings.localVariation.toFixed(1)} points; ${projection.iterations.toLocaleString()} simulations.`],
  ];
  const assumptionRows = [
    ["Candidate selection", "The 2022 candidate slate and candidate counts are the default baseline. Actual selections can differ; new or changed candidates may alter first-preference splits and outcomes. Constituency pages list the candidate count used in each seat."],
    ["Boundary alignment", "Historical Assembly results pre-date the current boundaries. Without ward-level results they cannot be exactly reassigned; 2024 Westminster results are used as a lower-weight proxy."],
    ["Transfers", "Transfer destinations are inferred from aggregate count changes, not individual ballot preferences. Ambiguous transitions, preference exhaustion and future transfer behaviour remain uncertain."],
    ["Probabilities", "Seat and candidate probabilities summarize the simulated counts. They are conditional on entered support, slate and settings and have not been calibrated as real-world odds."],
  ];
  const partyOutlookStandings = projection.standings.map((row) => {
    const party = parties.get(row.code)!;
    return { row, party };
  }).filter(({ row, party }) => party.baselineShare > 1 || row.baselineSeats > 0 || row.topFiveSeats > 0);
  const partyCharts = partyOutlookStandings.map(({ row, party }) => ({ title: party.code, color: party.color, mean: row.expectedSeats, standardDeviation: row.seatStandardDeviation, baseline: row.baselineSeats, outcomes: row.seatCountProbabilities, maxOutcome: 50, coloredHeader: true }));
  const blocCharts = projection.blocStandings.map((row) => ({ title: `${row.code} bloc`, color: blocColor[row.code] ?? C.cyan, mean: row.expectedSeats, standardDeviation: row.seatStandardDeviation, baseline: row.baselineSeats, outcomes: row.seatCountProbabilities, maxOutcome: 50, coloredHeader: true }));
  const chartPages = Math.ceil(partyCharts.length / 3);
  const constituencySectionPage = 6 + chartPages;
  const constituencyPagesStart = constituencySectionPage + 1;
  const acronymIndexPage = constituencyPagesStart + projection.constituencies.length * 2;
  const contents = [
    { number: "01", title: "Overall picture", page: 1, topics: [{ label: "National estimates and constituency map", page: 2 }] },
    { number: "02", title: "Parties and blocs", page: 3, topics: [{ label: "Party and bloc seat outlook", page: 4 }, { label: "Party seat distributions", page: 5 }, { label: "Community seat distributions", page: 5 + chartPages }] },
    { number: "03", title: "Constituencies", page: constituencySectionPage, topics: [], entries: projection.constituencies.map((item, index) => ({ label: item.name, page: constituencyPagesStart + index * 2 })) },
    { number: "04", title: "Party acronym index", page: acronymIndexPage, topics: [] },
  ];
  const nationalPartyRows = partyOutlookStandings.map(({ row, party }) => [
    { text: party.code, color: party.color }, `${pct(row.projectedShare)} +/- ${row.shareStandardDeviation.toFixed(1)}pp`, signed(row.shareChange),
    `${row.expectedSeats.toFixed(1)} +/- ${row.seatStandardDeviation.toFixed(1)}`, `${row.topFiveSeats} rounded seats  /  ${row.lowSeats}-${row.highSeats} middle 80%`,
  ]);
  const blocRows = projection.blocStandings.map((row) => [
    { text: row.code, color: blocColor[row.code] ?? C.cyan }, `${pct(row.share)} +/- ${row.shareStandardDeviation.toFixed(1)}pp`, signed(row.shareChange),
    `${row.expectedSeats.toFixed(1)} +/- ${row.seatStandardDeviation.toFixed(1)}`, `${row.baselineSeats} seats  /  ${pct(row.baselineShare)}`,
  ]);
  const overallSeatRows = partyOutlookStandings.map(({ row, party }) => ({ code: party.code, color: party.color, headlineSeats: row.topFiveSeats, voteShare: row.projectedShare, meanSeats: row.expectedSeats, lowSeats: row.lowSeats, highSeats: row.highSeats }));
  return <Document title="Confidential Projection Report" author="Ireland Votes" subject="Confidential constituency projection scenario">
    <PdfCoverPage logo={logo} date={reportDate}/>
    <PdfNoticePage logo={logo} label="Confidentiality" eyebrow="DISTRIBUTION NOTICE" title="Confidential" accent={C.cyan} body={["This report contains confidential Ireland Votes analysis, model outputs, scenario settings and working estimates. It is prepared for the intended recipient and for internal Ireland Votes use only.", "Please do not forward, publish, quote, reproduce or otherwise share this report outside Ireland Votes unless Ireland Votes has expressly permitted that use. Do not treat its contents as public polling or an official forecast. The recipient is responsible for keeping copies and extracts secure.", "If you received this report in error, please do not use or distribute it. Contact Ireland Votes and delete the report and any copies. Questions about permitted use or attribution should be directed to Ireland Votes before circulation."]}/>
    <Page size="A4" style={S.frontMatterPage}><PdfFrontMatterChrome logo={logo} label="Methodology  /  II"/><Text style={S.title}>Projection methodology</Text>
      <Text style={S.deck}>For each constituency, the model converts a national party-support scenario into candidate first preferences, then runs a simulated STV count. The reported shares, seat outcomes and probabilities are summaries across those repeated counts.</Text>
      <PdfSectionIntro number="01" title="National support becomes local support"/><Text style={S.deck}>Party support entered for the scenario is rescaled to total 100% and grouped into Nationalist, Unionist and Non-aligned communities. The model first adjusts each community's national share using its historical local strength in the constituency. Within each community, it then adjusts each contesting party according to its local performance within that community compared with its NI-wide performance. These local-strength multipliers carry constituency patterns into the scenario without adding a fixed number of percentage points. The cycle weights are 2022 Assembly 55%, 2017 Assembly 30% and 2024 House of Commons 15%. Missing party or community evidence contributes neutral strength for its missing weight, rather than allowing one observed cycle to stand in for the full history. Communities and parties absent from the selected candidate slate are removed; remaining active shares are re-normalized.</Text>
      <PdfSectionIntro number="02" title="Party support is split across candidates"/><Text style={S.deck}>In each constituency, only parties with at least one selected candidate are included. A party's projected first-preference votes are divided among its candidate slots. Where historical within-party candidate shares are available, those shares set the starting split; additional slots use an equal-share fallback. The split is varied slightly in each run, so candidates from the same party need not receive identical shares. Candidate names are generic labels, and the default party slate and candidate counts follow the 2022 baseline unless changed in the scenario.</Text>
      <PdfSectionIntro number="03" title="Each simulation runs an STV count"/><Text style={S.deck}>The quota is calculated as floor(valid votes ÷ (seats + 1)) + 1. Starting from simulated candidate first preferences, candidates at or above quota are elected in descending tally order; their surplus above quota is transferred. If no one reaches quota, the lowest continuing candidate is eliminated and their votes are transferred. The count continues until all seats are filled or every remaining candidate can fill the remaining seats. Surplus and elimination transfers use separate destination profiles, estimated from identifiable count transitions in the 2017 and 2022 Assembly returns. The model prefers party-specific evidence and falls back to pooled community evidence; if a usable destination profile is absent, it uses a simple community-weighted fallback. The retained share follows observed transfer retention where available, with the remainder treated as exhausted.</Text>
      <PdfSectionIntro number="04" title="Variation and reported outcomes"/><Text style={S.deck}>Across {projection.iterations.toLocaleString()} runs, national party shares vary with the polling-uncertainty setting ({settings.pollingUncertainty.toFixed(1)} points). Local community and within-community party shares vary with local variation ({settings.localVariation.toFixed(1)} points); candidate splits also receive a smaller run-to-run variation. The model records candidate first preferences, election outcomes, party and community seats, and count-stage events in every run. Means and standard deviations summarize vote shares and seats; outcome distributions show the simulated probability of each seat total. The constituency headline lists the five candidates most likely to be elected. Probabilities are conditional on these inputs, not calibrated real-world odds.</Text>
      <View style={S.note}><Text style={S.noteText}>The transfer profiles are inferred from aggregate count records, not individual ballot preferences. Boundary changes mean older Assembly results cannot be precisely mapped to today's constituencies without ward-level data. Candidate choices, turnout, campaign effects and preference behaviour may differ from the historical patterns used here.</Text></View>
    </Page>
    <Page size="A4" style={S.frontMatterPage}><PdfFrontMatterChrome logo={logo} label="Inputs and assumptions  /  III"/><Text style={S.title}>Inputs and assumptions</Text>
      <PdfSectionIntro number="01" title="Inputs used in this run"/><PdfTable headers={["Input", "Value used"]} widths={["25%", "75%"]} rows={inputRows} justify />
      <View style={{ marginTop: 16 }}><PdfSectionIntro number="02" title="Assumptions and limitations"/><PdfTable headers={["Assumption", "How it affects the estimate"]} widths={["25%", "75%"]} rows={assumptionRows} justify /></View>
      <View style={{ marginTop: 16 }}><PdfSectionIntro number="03" title="Reading the estimates"/><Text style={S.deck}>This is a conditional scenario analysis, not an official forecast. Results depend on the support, constituency history, transfer settings, uncertainty and candidate slate shown here. The last election's candidate selections and candidate counts are the starting baseline. Future candidate selections, candidate quality, turnout, campaign events and voter preferences may differ, changing first-preference splits and transfers. Probabilities describe the model's simulations and are not calibrated real-world odds or guarantees.</Text></View>
    </Page>
    <PdfContentsPage logo={logo} sections={contents} />
    <PdfSectionDivider logo={logo} date={reportDate} number="01" title="Overall picture" deck="Headline first-preference and seat estimates, the spread of simulated outcomes and the settings behind this scenario."/>
    <Page size="A4" style={S.page}><PdfChrome logo={logo} label="01  /  OVERALL PICTURE" date={reportDate}/><Text style={S.title}>The overall picture</Text>
      <PdfSeatHeadlineFigures rows={overallSeatRows} headlineNote="Headline seats sum each party’s candidates among the five highest election-probability candidates in every constituency." />
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
        <View style={{ width: "36%", alignItems: "center", paddingTop: 10 }}><Text style={{ alignSelf: "flex-start", marginBottom: 4, color: C.ink, fontSize: 9, fontWeight: 700 }}>Mean vote-share map</Text><Svg width={175} height={235} viewBox="0 0 420 520">{data.mapFeatures.filter((feature) => feature.path && !/\b(?:NaN|Infinity)\b/.test(feature.path)).map((feature) => { const area = projection.constituencies.find((item) => item.name === feature.name); const shareLeader = area?.parties.slice().sort((a, b) => b.firstPreferenceShare - a.firstPreferenceShare)[0]; return <Path key={feature.name} d={feature.path} fill={parties.get(shareLeader?.code ?? "")?.color ?? "#dce5e7"} stroke="#ffffff" strokeWidth={2}/>; })}</Svg><Text style={{ marginTop: 4, color: C.muted, fontSize: 6.2, textAlign: "center" }}>Each seat is shaded for its highest mean first-preference share.</Text></View>
        <View style={{ width: "62%" }}><PdfSeatRangePanel rows={overallSeatRows} maxSeats={projection.constituencies.reduce((sum, area) => sum + area.seats, 0)} /></View>
      </View>
    </Page>

    <PdfSectionDivider logo={logo} date={reportDate} number="02" title="Parties and blocs" deck="National first-preference estimates and seat-count distributions for parties and communities."/>
    <Page size="A4" style={S.page}><PdfChrome logo={logo} label="02  /  PARTY AND BLOC OUTLOOK" date={reportDate}/><Text style={S.title}>Party and bloc outlook</Text>
      <PdfSectionIntro number="01" title="Party seat movement"/>
      <PdfTable headers={["Party", "Mean FPV +/- SD", "Change vs 2022", "Mean seats +/- SD", "Rounded / middle 80%"]} widths={["19%", "19%", "18%", "21%", "22%"]} rows={nationalPartyRows} compact/>
      <View style={{ marginTop: 16 }}><PdfSectionIntro number="02" title="Bloc outlook"/></View>
      <PdfTable headers={["Community", "Mean FPV +/- SD", "Change", "Mean seats +/- SD", "Baseline"]} widths={["20%", "21%", "14%", "23%", "22%"]} rows={blocRows} compact/>
      <View style={S.note}><Text style={S.noteText}>The party outlook includes parties above 1% in the 2022 baseline, along with parties holding or projected to win seats. Minor parties remain visible in each constituency section.</Text></View>
    </Page>
    {Array.from({ length: chartPages }, (_, pageIndex) => <Page key={`nia-party-distribution-${pageIndex}`} size="A4" style={S.page}><PdfChrome logo={logo} label="02  /  PARTY DISTRIBUTIONS" date={reportDate}/><Text style={S.title}>Party distributions</Text><View style={{ gap: 12 }}>{partyCharts.slice(pageIndex * 3, pageIndex * 3 + 3).map((item) => <PdfDistributionChart key={item.title} {...item}/>)}</View></Page>)}
    <Page size="A4" style={S.page}><PdfChrome logo={logo} label="02  /  COMMUNITY DISTRIBUTIONS" date={reportDate}/><Text style={S.title}>Community distributions</Text><View style={{ gap: 12 }}>{blocCharts.map((item) => <PdfDistributionChart key={item.title} {...item}/>)}</View></Page>

    <PdfSectionDivider logo={logo} date={reportDate} number="03" title="Constituencies" deck="First preferences, party seat probabilities, candidate outcomes and community balance for every constituency."/>
    {projection.constituencies.map((area) => {
      const areaPartyRows = area.parties.slice().sort((a, b) => b.firstPreferenceShare - a.firstPreferenceShare).map((row) => {
        const party = parties.get(row.code)!;
        return [{ text: party.code, color: party.color }, `${pct(row.firstPreferenceShare)} +/- ${row.firstPreferenceStandardDeviation.toFixed(1)}pp`, signed(row.shareChange), `${row.expectedSeats.toFixed(2)} +/- ${row.seatStandardDeviation.toFixed(2)}`, outcomeText(row.seatCountProbabilities)];
      });
      const candidates = area.parties.flatMap((party) => party.candidates.map((candidate) => ({ ...candidate, code: party.code, color: parties.get(party.code)?.color ?? C.cyan }))).sort((a, b) => b.electionProbability - a.electionProbability || b.meanFirstPreferences - a.meanFirstPreferences);
      const candidateRows = candidates.map((candidate) => [
        { text: `${candidate.code}  ${candidate.name}`, color: candidate.color }, `${candidate.meanFirstPreferences.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, `${candidate.electionProbability.toFixed(1)}%`,
      ]);
      const areaBlocs = area.blocOutcomes.map((row) => [{ text: row.code, color: blocColor[row.code] ?? C.cyan }, `${pct(row.share)} +/- ${row.shareStandardDeviation.toFixed(1)}pp`, signed(row.shareChange), `${row.expectedSeats.toFixed(2)} +/- ${row.seatStandardDeviation.toFixed(2)}`, outcomeText(row.seatCountProbabilities)]);
      return <Fragment key={area.name}>
      <Page size="A4" style={S.page}><PdfChrome logo={logo} label="03  /  CONSTITUENCIES" date={reportDate}/>
        <PdfConstituencyHeading name={area.name} prominent /><Text style={S.deck}>{area.seats} seats  ·  Droop quota {area.quota.toLocaleString()}  ·  {area.validVotes.toLocaleString()} baseline valid first preferences</Text>
        <PdfSectionIntro number="01" title="Party first preferences and seats"/>
        <PdfTable headers={["Party", "Mean FPV +/- SD", "Change", "Mean seats +/- SD", "Most likely totals"]} widths={["24%", "22%", "13%", "19%", "22%"]} rows={areaPartyRows} compact/>
        <View style={{ marginTop: 16 }}><PdfSectionIntro number="02" title="Projected bloc outlook"/></View>
        <PdfTable headers={["Bloc", "Mean FPV +/- SD", "Change", "Mean seats +/- SD", "Most likely totals"]} widths={["17%", "23%", "14%", "22%", "24%"]} rows={areaBlocs} compact/>
        <View style={S.note}><Text style={S.noteText}>Minor parties remain visible in constituency results. Candidate rankings are on the following page.</Text></View>
      </Page>
      <Page size="A4" style={S.page}><PdfChrome logo={logo} label="03  /  CANDIDATE OUTCOMES" date={reportDate}/>
        <PdfConstituencyHeading name={area.name} /><Text style={S.deck}>{candidates.length} candidates across {new Set(candidates.map((candidate) => candidate.code)).size} included parties</Text>
        <PdfTable headers={["Candidate", "Mean first preferences", "Probability elected"]} widths={["42%", "29%", "29%"]} rows={candidateRows}/>
        <View style={S.note}><Text style={S.noteText}>Candidate labels are generic. Ranked probabilities describe each candidate’s chance of election in the simulated STV counts; they depend on the included slate and configured assumptions.</Text></View>
      </Page>
      </Fragment>;
    })}
    <PdfAcronymIndex logo={logo} date={reportDate} entries={data.parties.map(({ code, name }) => ({ code, name })).sort((a, b) => a.code.localeCompare(b.code))}/>
    <PdfClosingPage logo={logo} date={reportDate} />
  </Document>;
}
