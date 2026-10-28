import { Fragment } from "react";
import { Document, Page, Path, Svg, Text, View } from "@react-pdf/renderer";
import type { SeatProjectionBaseline, SeatProjectionConstituency } from "@/lib/staff/seatProjectionData";
import { PROJECTION_BLOCS, type ProjectionBloc } from "@/lib/staff/projectionBlocs";
import { PDF_COLORS as C, PDF_STYLES as S, PdfAcronymIndex, PdfChrome, PdfClosingPage, PdfConstituencyHeading, PdfContentsPage, PdfCoverPage, PdfDistributionChart, PdfFrontMatterChrome, PdfNoticePage, PdfSectionDivider, PdfSectionIntro, PdfTable } from "./ProjectionPdfKit";

type Probability = { outcome: number; probability: number };
type ProjectedSeat = SeatProjectionConstituency & {
  projected: Array<{ code: string; share: number; shareStandardDeviation: number; baselineShare: number; shareChange: number }>;
  winner: string; runnerUp: string; margin: number; winProbability: Record<string, number>;
  projectedBlocShares: Record<ProjectionBloc, number>;
  blocOutcomes: Array<{ code: ProjectionBloc; share: number; shareStandardDeviation: number; baselineShare: number; shareChange: number; expectedSeats: number; seatStandardDeviation: number; baselineSeats: number; seatCountProbabilities: Probability[] }>;
};
type Standing = { code: string; name: string; color: string; projectedShare: number; seats: number; medianSeats: number; lowSeats: number; highSeats: number; largestPartyProbability: number; expectedSeats: number; seatStandardDeviation: number; seatChange: number; shareChange: number; projectedShareStandardDeviation: number; seatCountProbabilities: Probability[] };
type ProjectionReport = { constituencies: ProjectedSeat[]; iterations: number; standings: Standing[]; blocStandings: Array<{ code: ProjectionBloc; share: number; shareStandardDeviation: number; baselineShare: number; shareChange: number; expectedSeats: number; seatStandardDeviation: number; baselineSeats: number; seatCountProbabilities: Probability[] }> };
type InterBlocTacticalVoting = { nationalistToNonAligned: number; nonAlignedToNationalist: number; unionistToNonAligned: number; nonAlignedToUnionist: number };

export type SeatProjectionPdfProps = {
  data: SeatProjectionBaseline; projection: ProjectionReport; support: Record<string, string>; reportDate: string; logoSrc: string;
  pollError: number; localVariation: number; previousResultWeight: number;
  tacticalVoting: Record<ProjectionBloc, number>; interBlocTacticalVoting: InterBlocTacticalVoting;
};

const blocColor: Record<ProjectionBloc, string> = { Nationalist: "#14765f", Unionist: "#436fa8", "Non-aligned": "#d49b22" };
const pct = (value: number) => `${value.toFixed(1)}%`;
const signed = (value: number, suffix = "pp") => `${value >= 0 ? "+" : ""}${value.toFixed(1)} ${suffix}`;
const shownOutcomes = (items: Probability[]) => items.filter((item) => item.probability >= 0.1).map((item) => `${item.outcome}: ${item.probability.toFixed(1)}%`).join("  |  ") || "No material probability";
const leadingOutcomes = (items: Probability[]) => items.slice().sort((a, b) => b.probability - a.probability).slice(0, 3).sort((a, b) => a.outcome - b.outcome).map((item) => `${item.outcome}: ${item.probability.toFixed(1)}%`).join("  |  ");
const oneSeat = (probability: number): Probability[] => [{ outcome: 0, probability: 100 - probability }, { outcome: 1, probability }];
export default function SeatProjectionPdf({ data, projection, support, reportDate, logoSrc, pollError, localVariation, previousResultWeight, tacticalVoting, interBlocTacticalVoting }: SeatProjectionPdfProps) {
  const partyByCode = new Map(data.parties.map((party) => [party.code, party]));
  const totalSeats = projection.constituencies.reduce((sum, seat) => sum + seat.seats, 0);
  const contestingSummary = data.parties.map((party) => ({ code: party.code, seats: projection.constituencies.filter((seat) => seat.contestantCodes.includes(party.code)).length })).filter((party) => party.seats > 0).map((party) => `${party.code} (${party.seats})`).join(", ");
  const supportSummary = data.parties.filter((party) => Number(support[party.code]) > 0).map((party) => `${party.code} ${Number(support[party.code]).toFixed(1)}%`).join("  /  ") || "No positive party support entered";
  const tacticalSummary = `Within blocs: Nationalist ${tacticalVoting.Nationalist}%, Unionist ${tacticalVoting.Unionist}%, Non-aligned ${tacticalVoting["Non-aligned"]}%. Across blocs: Nationalist to Non-aligned ${interBlocTacticalVoting.nationalistToNonAligned}%; Non-aligned to Nationalist ${interBlocTacticalVoting.nonAlignedToNationalist}%; Unionist to Non-aligned ${interBlocTacticalVoting.unionistToNonAligned}%; Non-aligned to Unionist ${interBlocTacticalVoting.nonAlignedToUnionist}%.`;
  const inputRows = [
    ["Selected baseline", `${data.electionLabel} (${data.baselineYear})`],
    ["National party support", supportSummary],
    ["Party slate", `${contestingSummary}. Defaults to the selected baseline's party slate; staff can edit inclusion by constituency.`],
    ["Historical results", "Westminster 2019: 37.5%; 2017: 22.5%; 2015: 15%. Assembly 2022: 17.5%; 2017: 7.5%. Later data is excluded from historical inputs."],
    ["Tactical settings", tacticalSummary],
    ["Uncertainty and simulations", `Polling uncertainty ${pollError.toFixed(1)} points; local variation ${localVariation.toFixed(1)} points; historical swing influence ${previousResultWeight}%; ${projection.iterations.toLocaleString()} simulations.`],
  ];
  const assumptionRows = [
    ["Candidate selection", "The last election's candidate slate is the starting point. Each included party has one candidate in a constituency. Named candidate effects and changes in candidate quality are not modelled; actual candidate selections can materially change the result."],
    ["Local history", "Past constituency results are used as evidence of how local bloc and party support differs from national support. These patterns are assumed to remain informative after national support changes."],
    ["Backtest interpretation", data.baselineYear === "2019" ? "If the scenario uses actual 2024 national shares, treat it as a diagnostic rather than a blind backtest. 2024 constituency outcomes are excluded from model fitting." : "The current 2024 mode uses observed 2024 constituency results as local baseline evidence."],
    ["Tactical movement", "Nationalist and Unionist voters do not transfer directly to one another. Cross-bloc movement is allowed only between either of those blocs and Non-aligned, and only in close contests."],
    ["Boundaries and data", "Historical Assembly and Westminster elections use different electoral systems and, in some cases, different boundaries. Older results are informative proxies rather than exact current-boundary returns."],
  ];
  const partyOutlook = projection.standings.filter((item) => {
    const party = partyByCode.get(item.code);
    return (party?.baselineShare ?? 0) > 1 || (party?.baselineSeats ?? 0) > 0 || item.seats > 0;
  });
  const partyCharts = partyOutlook.map((item) => ({ title: item.code, color: item.color, mean: item.expectedSeats, standardDeviation: item.seatStandardDeviation, baseline: partyByCode.get(item.code)?.baselineSeats ?? 0, outcomes: item.seatCountProbabilities, maxOutcome: Math.max(1, ...item.seatCountProbabilities.map((x) => x.outcome)), coloredHeader: true }));
  const blocCharts = projection.blocStandings.map((item) => ({ title: `${item.code} bloc`, color: blocColor[item.code], mean: item.expectedSeats, standardDeviation: item.seatStandardDeviation, baseline: item.baselineSeats, outcomes: item.seatCountProbabilities, maxOutcome: totalSeats, coloredHeader: true }));
  const chartPages = Math.ceil(partyCharts.length / 3);
  const constituencySectionPage = 6 + chartPages;
  const acronymIndexPage = constituencySectionPage + 1 + projection.constituencies.length * 2;
  const contents = [
    { number: "01", title: "Overall picture", page: 1, topics: [{ label: "National estimates and constituency map", page: 2 }] },
    { number: "02", title: "Parties and blocs", page: 3, topics: [{ label: "Party and bloc seat outlook", page: 4 }, { label: "Party seat distributions", page: 5 }, { label: "Community seat distributions", page: 5 + chartPages }] },
    { number: "03", title: "Constituencies", page: constituencySectionPage, topics: [], entries: projection.constituencies.map((item, index) => ({ label: item.name, page: constituencySectionPage + 1 + index * 2 })) },
    { number: "04", title: "Party acronym index", page: acronymIndexPage, topics: [] },
  ];
  const partyRows = partyOutlook.map((item) => [
    { text: item.code, color: item.color },
    `${pct(item.projectedShare)}  +/- ${item.projectedShareStandardDeviation.toFixed(1)}pp`,
    signed(item.shareChange),
    `${item.expectedSeats.toFixed(1)} +/- ${item.seatStandardDeviation.toFixed(1)}`,
    `${item.seats} modal  /  ${item.lowSeats}-${item.highSeats} middle 80%`,
    leadingOutcomes(item.seatCountProbabilities),
  ]);
  const blocRows = projection.blocStandings.map((item) => [
    { text: item.code, color: blocColor[item.code] }, `${pct(item.share)} +/- ${item.shareStandardDeviation.toFixed(1)}pp`, signed(item.shareChange),
    `${item.expectedSeats.toFixed(1)} +/- ${item.seatStandardDeviation.toFixed(1)}`, `${item.baselineSeats} seats  /  ${pct(item.baselineShare)}`, leadingOutcomes(item.seatCountProbabilities),
  ]);

  return <Document title="Confidential Projection Report" author="Ireland Votes" subject="Confidential constituency projection scenario">
    <PdfCoverPage logo={logoSrc} date={reportDate} />
    <PdfNoticePage logo={logoSrc} label="Confidentiality" eyebrow="DISTRIBUTION NOTICE" title="Confidential" accent={C.cyan} body={["This report contains confidential Ireland Votes analysis, model outputs, scenario settings and working estimates. It is prepared for the intended recipient and for internal Ireland Votes use only.", "Please do not forward, publish, quote, reproduce or otherwise share this report outside Ireland Votes unless Ireland Votes has expressly permitted that use. Do not treat its contents as public polling or an official forecast. The recipient is responsible for keeping copies and extracts secure.", "If you received this report in error, please do not use or distribute it. Contact Ireland Votes and delete the report and any copies. Questions about permitted use or attribution should be directed to Ireland Votes before circulation."]}/>
    <Page size="A4" style={S.frontMatterPage}><PdfFrontMatterChrome logo={logoSrc} label="Methodology  /  II"/><Text style={S.title}>How constituency estimates are formed</Text>
      <Text style={S.deck}>Each constituency estimate combines the national support scenario with a record of how parties and communities have performed locally. The model then applies the configured movement and uncertainty assumptions across repeated simulations.</Text>
      <PdfSectionIntro number="01" title="National support and community structure"/><Text style={S.deck}>Party support is normalized to 100% and grouped into Nationalist, Unionist and Non-aligned blocs. The selected baseline determines which historical results are eligible. In current 2024 mode, observed constituency bloc composition anchors the local starting point. In 2019 backtest mode, local fundamentals use only elections available before the 2024 result.</Text>
      <PdfSectionIntro number="02" title="Local electoral history"/><Text style={S.deck}>Historical results show how each bloc performed in a constituency relative to its NI-wide performance, and how each party performed locally within its bloc. These local-strength multipliers are combined across eligible cycles and applied to the scenario support; the model does not add a fixed number of points. Westminster evidence is weighted at 2019: 37.5%, 2017: 22.5% and 2015: 15%. Assembly evidence is weighted at 2022: 17.5% and 2017: 7.5%. The electoral systems remain distinct, and evidence is reduced where a party contested fewer constituencies.</Text>
      <PdfSectionIntro number="03" title="Tactical movement and uncertainty"/><Text style={S.deck}>Configured tactical movement can consolidate support within a bloc. Cross-community movement is allowed between Nationalist and Non-aligned, or Unionist and Non-aligned, only when the receiving bloc is a close challenger. Nationalist and Unionist voters do not move directly between those blocs. Each run includes {projection.iterations.toLocaleString()} simulations. Polling uncertainty ({pollError.toFixed(1)} points), local variation ({localVariation.toFixed(1)} points) and historical swing influence ({previousResultWeight}%) vary the estimated outcomes. Expected seats are simulation means; modal seats record each constituency's most frequent winner. Standard deviations and seat-count distributions describe spread, while win probabilities remain conditional model outputs rather than calibrated real-world odds.</Text>
    </Page>
    <Page size="A4" style={S.frontMatterPage}><PdfFrontMatterChrome logo={logoSrc} label="Inputs and assumptions  /  III"/><Text style={S.title}>Inputs and assumptions</Text>
      <PdfSectionIntro number="01" title="Inputs used in this run"/><PdfTable headers={["Input", "Value used"]} widths={["25%", "75%"]} rows={inputRows} justify />
      <View style={{ marginTop: 16 }}><PdfSectionIntro number="02" title="Assumptions and limitations"/><PdfTable headers={["Assumption", "How it affects the estimate"]} widths={["25%", "75%"]} rows={assumptionRows} justify /></View>
      <View style={{ marginTop: 16 }}><PdfSectionIntro number="03" title="Reading the estimates"/><Text style={S.deck}>This is a conditional scenario analysis, not an official forecast. Results depend on the support, historical evidence, tactical settings and candidate slate shown here. The last election's candidate selection is the starting baseline; future candidate selections, candidate quality, turnout, campaign events and voter behaviour may differ and materially change the result. Win probabilities and standard deviations describe the model's simulations and are not calibrated real-world odds or guarantees.</Text></View>
      {data.baselineYear === "2019" && <Text style={[S.noteText, { marginTop: 8 }]}>Backtest note: using actual 2024 national shares is a held-out diagnostic, not a blind forecast. 2024 constituency outcomes remain excluded from model fitting.</Text>}
    </Page>
    <PdfContentsPage logo={logoSrc} sections={contents} />
    <PdfSectionDivider logo={logoSrc} date={reportDate} number="01" title="Overall picture" deck="Headline seat estimates, geographic pattern and the scenario inputs behind this projection." />
    <Page size="A4" style={S.page}><PdfChrome logo={logoSrc} label="01  /  OVERALL PICTURE" date={reportDate}/><Text style={S.title}>The overall picture</Text>
      <View style={{ alignItems: "center", marginBottom: 5 }}><Svg width={145} height={180} viewBox="0 0 420 520">{data.mapFeatures.map((feature) => { const constituency = projection.constituencies.find((seat) => seat.name === feature.name); const shareLeader = constituency?.projected.filter((party) => party.share > 0).sort((a, b) => b.share - a.share)[0]; return <Path key={feature.name} d={feature.path} fill={partyByCode.get(shareLeader?.code ?? "")?.color ?? "#dce5e7"} stroke="#ffffff" strokeWidth={2}/>; })}</Svg><Text style={{ marginTop: 2, color: C.muted, fontSize: 6.5 }}>Shaded by the party with the highest mean projected vote share in each constituency.</Text></View>
      <PdfTable headers={["Party", "Mean FPV +/- SD", "Change", "Mean seats +/- SD", "Modal / range", "Most likely totals"]} widths={["17%", "16%", "10%", "16%", "16%", "25%"]} rows={partyRows} compact />
      <View style={S.note}><Text style={S.noteText}>Scenario estimates are conditional on the inputs and assumptions shown in this report. Probabilities and standard deviations describe this model’s simulations; they are not calibrated guarantees of electoral outcomes.</Text></View>
    </Page>

    <PdfSectionDivider logo={logoSrc} date={reportDate} number="02" title="Parties and blocs" deck="How national support translates into seat outcomes, with probability distributions for parties and communities." />
    <Page size="A4" style={S.page}><PdfChrome logo={logoSrc} label="02  /  PARTY AND BLOC OUTLOOK" date={reportDate}/><Text style={S.title}>Party and bloc outlook</Text>
      <PdfSectionIntro number="01" title="Party seat movement" />
      <PdfTable headers={["Party", "Mean FPV +/- SD", "Change vs baseline", "Mean seats +/- SD", "Modal / middle 80%", "Exact seat totals"]} widths={["17%", "16%", "14%", "16%", "16%", "21%"]} rows={partyRows} compact />
      <View style={{ marginTop: 16 }}><PdfSectionIntro number="02" title="Bloc outlook" /></View>
      <PdfTable headers={["Community", "Mean FPV +/- SD", "Change", "Mean seats +/- SD", "Baseline", "Most likely totals"]} widths={["16%", "18%", "12%", "18%", "16%", "20%"]} rows={blocRows} compact />
      <View style={S.note}><Text style={S.noteText}>The party outlook includes parties above 1% in the baseline election, along with parties holding or projected to win seats. A standard deviation describes the spread of simulated outcomes; modal seats need not equal the mean.</Text></View>
    </Page>
    {Array.from({ length: chartPages }, (_, pageIndex) => <Page key={`national-party-distribution-${pageIndex}`} size="A4" style={S.page}><PdfChrome logo={logoSrc} label="02  /  PARTY DISTRIBUTIONS" date={reportDate}/><Text style={S.title}>Party distributions</Text>
      <View style={{ gap: 12 }}>{partyCharts.slice(pageIndex * 3, pageIndex * 3 + 3).map((item, index) => <PdfDistributionChart key={`${item.title}-${index}`} {...item}/>)}</View>
    </Page>)}
    <Page size="A4" style={S.page}><PdfChrome logo={logoSrc} label="02  /  COMMUNITY DISTRIBUTIONS" date={reportDate}/><Text style={S.title}>Community distributions</Text><View style={{ gap: 12 }}>{blocCharts.map((item) => <PdfDistributionChart key={item.title} {...item}/>)}</View></Page>

    <PdfSectionDivider logo={logoSrc} date={reportDate} number="03" title="Constituencies" deck="Projected vote shares, constituency fundamentals, bloc outlook and win probabilities for every seat." />
    {projection.constituencies.map((constituency) => {
      const shareLeaders = [...constituency.projected].sort((a, b) => b.share - a.share);
      const topTwo = shareLeaders.slice(0, 2);
      const otherParties = shareLeaders.slice(2);
      const rows = constituency.projected.map((item) => {
        const party = partyByCode.get(item.code);
        return [{ text: item.code, color: party?.color }, `${pct(item.share)} +/- ${item.shareStandardDeviation.toFixed(1)}pp`, signed(item.shareChange), `${(constituency.winProbability[item.code] ?? 0).toFixed(1)}%`, `${(constituency.partyShares[item.code] ?? 0).toFixed(1)}%`];
      });
      const blocRowsLocal = constituency.blocOutcomes.map((item) => [{ text: item.code, color: blocColor[item.code] }, `${pct(item.share)} +/- ${item.shareStandardDeviation.toFixed(1)}pp`, signed(item.shareChange), `${item.expectedSeats.toFixed(2)} +/- ${item.seatStandardDeviation.toFixed(2)}`, shownOutcomes(item.seatCountProbabilities)]);
      const historicalYears = ["2019", "2017", "2015"] as const;
      const historyRows = constituency.projected.map((item) => [item.code, ...historicalYears.map((year) => constituency.historicalPartyShares[year][item.code] === undefined ? "—" : pct(constituency.historicalPartyShares[year][item.code])), ...(["2022", "2017"] as const).map((year) => pct(constituency.assemblyPartyShares[year][item.code] ?? 0))]);
      return <Fragment key={constituency.name}>
        <Page size="A4" style={S.page}>
          <PdfChrome logo={logoSrc} label="03  /  CONSTITUENCIES" date={reportDate}/>
          <PdfConstituencyHeading name={constituency.name} prominent />
          <View style={{ marginTop: 8, marginBottom: 23, padding: 13, backgroundColor: C.ink }}>
            <Text style={{ color: "#adbec0", fontSize: 6.5, letterSpacing: 0.9 }}>PROBABILITY OF WIN</Text>
            <View style={{ marginTop: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "stretch" }}>
              {topTwo.map((party, index) => {
                const probability = constituency.winProbability[party.code] ?? 0;
                return <View key={party.code} style={{ width: "48%", alignItems: index === 0 ? "flex-start" : "flex-end", borderLeftWidth: index === 0 ? 3 : 0, borderRightWidth: index === 1 ? 3 : 0, borderLeftColor: partyByCode.get(party.code)?.color ?? C.cyan, borderRightColor: partyByCode.get(party.code)?.color ?? C.cyan, paddingLeft: index === 0 ? 8 : 0, paddingRight: index === 1 ? 8 : 0 }}>
                  <Text style={{ color: C.white, fontSize: 18, fontWeight: 700, textAlign: index === 0 ? "left" : "right" }}>{party.code}</Text>
                  <Text style={{ marginTop: 2, color: C.cyanLight, fontSize: 19, lineHeight: 1, fontWeight: 700 }}>{probability.toFixed(1)}%</Text>
                  <Text style={{ marginTop: 3, color: "#b8c8ca", fontSize: 6.5 }}>{pct(party.share)} projected share</Text>
                </View>;
              })}
            </View>
            {otherParties.length > 0 && <Text style={{ marginTop: 8, color: "#c4d0d2", fontSize: 7, lineHeight: 1.4, textAlign: "center" }}>Other win chances: {otherParties.map((party) => `${party.code} ${(constituency.winProbability[party.code] ?? 0).toFixed(1)}%`).join("  ·  ")}</Text>}
            <View style={{ height: 6, flexDirection: "row", overflow: "hidden", marginTop: 10, borderRadius: 2 }}>
              {shareLeaders.filter((party) => party.share > 0).map((party) => <View key={party.code} style={{ width: `${party.share}%`, height: 6, backgroundColor: partyByCode.get(party.code)?.color ?? "#89999c" }} />)}
            </View>
          </View>
          <PdfSectionIntro number="01" title="Projected party vote" />
          <PdfTable headers={["Party", "Mean share +/- SD", "Change", "Win probability", `${data.baselineYear} baseline`]} widths={["27%", "21%", "14%", "18%", "20%"]} rows={rows} compact />
          <View style={{ marginTop: 16 }}><PdfSectionIntro number="02" title="Projected bloc outlook" /></View>
          <PdfTable headers={["Bloc", "Mean share +/- SD", "Change", "Mean seats +/- SD", "Most likely totals"]} widths={["17%", "23%", "14%", "22%", "24%"]} rows={blocRowsLocal} compact />
          <View style={[S.note, { marginTop: 10 }]}><Text style={S.noteText}>Parties not included as contesting cannot win this constituency. Bloc estimates summarize community-level support separately from party vote estimates.</Text></View>
        </Page>
        <Page size="A4" style={S.page}>
          <PdfChrome logo={logoSrc} label="03  /  CONSTITUENCY HISTORY" date={reportDate}/>
        <PdfConstituencyHeading name={constituency.name} />
          <Text style={S.deck}>Historic constituency first-preference shares provide the local signal used by the projection. Westminster and Assembly results are shown separately.</Text>
          <PdfSectionIntro number="03" title="Historical party results" />
          <PdfTable headers={["Party", "2019 HOC", "2017 HOC", "2015 HOC", "2022 Assembly", "2017 Assembly"]} widths={["18%", "14%", "14%", "14%", "20%", "20%"]} rows={historyRows} />
          <View style={S.note}><Text style={S.noteText}>Baseline winner: {constituency.baselineWinner}. Boundary changes mean that some older Westminster results do not align exactly with the current constituency map; the 2024 HOC data provides a current-boundary reference where available.</Text></View>
        </Page>
      </Fragment>;
    })}
    <PdfAcronymIndex logo={logoSrc} date={reportDate} entries={data.parties.map(({ code, name }) => ({ code, name })).sort((a, b) => a.code.localeCompare(b.code))}/>
    <PdfClosingPage logo={logoSrc} date={reportDate} />
  </Document>;
}
