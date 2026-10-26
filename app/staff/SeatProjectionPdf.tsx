import {
  Document,
  Font,
  Image,
  Page,
  Path,
  StyleSheet,
  Svg,
  Text,
  View,
} from "@react-pdf/renderer";
import type { SeatProjectionData, SeatProjectionConstituency } from "@/lib/staff/seatProjectionData";
import { PROJECTION_BLOCS, type ProjectionBloc } from "@/lib/staff/projectionBlocs";

Font.register({
  family: "Averta",
  fonts: [
    { src: "/fonts/AvertaPdf-Regular.ttf", fontWeight: 400 },
    { src: "/fonts/AvertaPdf-Semibold.ttf", fontWeight: 600 },
    { src: "/fonts/AvertaPdf-Bold.ttf", fontWeight: 700 },
  ],
});

type ProjectedSeat = SeatProjectionConstituency & {
  projected: Array<{ code: string; share: number }>;
  winner: string;
  runnerUp: string;
  margin: number;
  winProbability: Record<string, number>;
  projectedBlocShares: Record<ProjectionBloc, number>;
};

type ProjectionReport = {
  constituencies: ProjectedSeat[];
  iterations: number;
  standings: Array<{
    code: string;
    name: string;
    color: string;
    projectedShare: number;
    seats: number;
    medianSeats: number;
    lowSeats: number;
    highSeats: number;
    largestPartyProbability: number;
  }>;
};

type InterBlocTacticalVoting = {
  nationalistToNonAligned: number;
  nonAlignedToNationalist: number;
  unionistToNonAligned: number;
  nonAlignedToUnionist: number;
};

export type SeatProjectionPdfProps = {
  data: SeatProjectionData;
  projection: ProjectionReport;
  support: Record<string, string>;
  reportDate: string;
  logoSrc: string;
  pollError: number;
  localVariation: number;
  previousResultWeight: number;
  tacticalVoting: Record<ProjectionBloc, number>;
  interBlocTacticalVoting: InterBlocTacticalVoting;
};

const colors = {
  ink: "#172326",
  ink2: "#26383c",
  muted: "#607176",
  faint: "#edf3f4",
  line: "#d8e2e4",
  cyan: "#00b9c7",
  cyanPale: "#e8f8f9",
  white: "#ffffff",
};

const styles = StyleSheet.create({
  page: { paddingTop: 63, paddingBottom: 48, paddingHorizontal: 38, color: colors.ink, fontFamily: "Averta", fontSize: 9 },
  header: { position: "absolute", top: 0, left: 0, right: 0, height: 45, paddingHorizontal: 38, backgroundColor: colors.ink, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerLogo: { width: 108, height: 32, objectFit: "contain", objectPosition: "left center" },
  headerSection: { color: "#b9c9cb", fontSize: 7, letterSpacing: 1.1, textTransform: "uppercase" },
  headerRule: { position: "absolute", top: 45, left: 0, right: 0, height: 3, backgroundColor: colors.cyan },
  footer: { position: "absolute", left: 38, right: 38, bottom: 18, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 7 },
  footerText: { color: "#7b898d", fontSize: 7, letterSpacing: 0.6 },
  pageNumber: { color: colors.ink2, fontSize: 8, fontWeight: 700 },
  eyebrow: { marginBottom: 5, color: "#008d98", fontSize: 7, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase" },
  title: { marginBottom: 7, color: colors.ink, fontSize: 25, fontWeight: 700, lineHeight: 1.08, letterSpacing: -0.6 },
  subheading: { marginTop: 15, marginBottom: 6, color: colors.ink, fontSize: 11, fontWeight: 700 },
  compactHeading: { marginTop: 6, marginBottom: 3, fontSize: 9 },
  body: { color: colors.muted, fontSize: 8.3, lineHeight: 1.48 },
  cover: { padding: 44, color: colors.white, backgroundColor: colors.ink, justifyContent: "space-between", fontFamily: "Averta" },
  coverTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  coverLogo: { width: 150, height: 52, objectFit: "contain", objectPosition: "left center" },
  coverTag: { paddingVertical: 7, paddingHorizontal: 10, borderRadius: 12, color: "#9ce8eb", backgroundColor: "#26383c", fontSize: 7, fontWeight: 700, letterSpacing: 0.8 },
  coverMain: { marginTop: 55 },
  coverEyebrow: { marginBottom: 15, color: "#71dce1", fontSize: 8, fontWeight: 700, letterSpacing: 1.8, textTransform: "uppercase" },
  coverTitle: { maxWidth: 480, color: colors.white, fontSize: 38, fontWeight: 700, lineHeight: 1.02, letterSpacing: -1.2 },
  coverDeck: { maxWidth: 440, marginTop: 15, color: "#c5d1d3", fontSize: 12, lineHeight: 1.5 },
  coverAccent: { width: 95, height: 4, marginTop: 24, backgroundColor: colors.cyan },
  coverFacts: { flexDirection: "row", gap: 9, marginTop: 28 },
  coverFact: { flexGrow: 1, flexBasis: 0, padding: 12, borderWidth: 1, borderColor: "#425256", borderRadius: 5, backgroundColor: "#202f32" },
  coverFactLabel: { color: "#adbec0", fontSize: 7 },
  coverFactValue: { marginTop: 5, color: colors.white, fontSize: 12, fontWeight: 700 },
  coverBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", borderTopWidth: 1, borderTopColor: "#425256", paddingTop: 12 },
  coverDisclaimer: { color: "#a7b8ba", fontSize: 8 },
  coverDate: { color: "#d5e0e1", fontSize: 8 },
  metricRow: { flexDirection: "row", gap: 7, marginTop: 10, marginBottom: 10 },
  metric: { flexGrow: 1, flexBasis: 0, padding: 9, borderWidth: 1, borderColor: colors.line, borderRadius: 4, backgroundColor: "#f6f9fa" },
  metricLabel: { color: colors.muted, fontSize: 7 },
  metricValue: { marginTop: 4, color: colors.ink, fontSize: 13, fontWeight: 700 },
  mapColumn: { width: "100%", alignItems: "center" },
  map: { width: 150, height: 185 },
  mapLegend: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6, marginTop: 4 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 3 },
  legendDot: { width: 6, height: 6, borderRadius: 2 },
  legendText: { color: colors.muted, fontSize: 6.5, fontWeight: 700 },
  table: { width: "100%", marginTop: 5, borderWidth: 1, borderColor: colors.line, borderRadius: 3 },
  tableRow: { minHeight: 20, flexDirection: "row", alignItems: "center", borderBottomWidth: 0.5, borderBottomColor: colors.line },
  compactRow: { minHeight: 14 },
  tableHead: { minHeight: 25, backgroundColor: colors.ink2 },
  tableCell: { minWidth: 0, flexShrink: 1, paddingVertical: 3, paddingHorizontal: 4, color: colors.ink2, fontSize: 7 },
  compactCell: { paddingVertical: 1.5, paddingHorizontal: 3, fontSize: 6.5 },
  tableHeadCell: { color: colors.white, fontSize: 6.5, fontWeight: 700 },
  tableParty: { flexDirection: "row", alignItems: "center", gap: 4 },
  partyDot: { width: 6, height: 6, borderRadius: 2 },
  inputGrid: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 5 },
  inputChip: { minWidth: 72, flexDirection: "row", justifyContent: "space-between", gap: 7, paddingVertical: 5, paddingHorizontal: 6, borderWidth: 1, borderColor: colors.line, borderRadius: 3, backgroundColor: colors.white },
  inputLabel: { color: colors.muted, fontSize: 7 },
  inputValue: { color: colors.ink, fontSize: 7, fontWeight: 700 },
  note: { marginTop: 10, padding: 9, borderLeftWidth: 3, borderLeftColor: colors.cyan, backgroundColor: colors.cyanPale },
  sectionBlock: { marginBottom: 4 },
  winnerPanel: { marginTop: 8, paddingVertical: 11, paddingHorizontal: 13, borderLeftWidth: 4, borderRadius: 3, backgroundColor: colors.ink },
  winnerLabel: { color: "#b8c8ca", fontSize: 7, textTransform: "uppercase", letterSpacing: 0.8 },
  winnerName: { marginTop: 4, color: colors.white, fontSize: 19, fontWeight: 700 },
  winnerChance: { marginTop: 4, color: "#70dce1", fontSize: 8, fontWeight: 700 },
  seatMetrics: { flexDirection: "row", gap: 7, marginVertical: 5 },
  seatMetric: { flexGrow: 1, flexBasis: 0, padding: 8, borderWidth: 1, borderColor: colors.line, borderRadius: 3, backgroundColor: "#f6f9fa" },
  seatMetricLabel: { color: colors.muted, fontSize: 6.5, textTransform: "uppercase", letterSpacing: 0.5 },
  seatMetricValue: { marginTop: 3, color: colors.ink, fontSize: 10, fontWeight: 700 },
});

function Header({ logoSrc, section }: { logoSrc: string; section: string }) {
  return <><View fixed style={styles.header}><Image src={logoSrc} style={styles.headerLogo} /><Text style={styles.headerSection}>{section}</Text></View><View fixed style={styles.headerRule} /></>;
}

function Footer({ reportDate }: { reportDate: string }) {
  return <View fixed style={styles.footer}><Text style={styles.footerText}>IRELAND VOTES · SCENARIO ESTIMATE · {reportDate}</Text><Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} /></View>;
}

function ReportTable({
  headers,
  rows,
  widths,
  compact = false,
}: {
  headers: string[];
  rows: Array<Array<string | { text: string; color?: string }>>;
  widths: string[];
  compact?: boolean;
}) {
  return (
    <View style={styles.table}>
      <View style={[styles.tableRow, styles.tableHead]}>
        {headers.map((header, index) => <Text key={header} style={[styles.tableCell, styles.tableHeadCell, compact ? styles.compactCell : {}, { width: widths[index] }]}>{header}</Text>)}
      </View>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} wrap={false} style={[styles.tableRow, compact ? styles.compactRow : {}, rowIndex % 2 === 1 ? { backgroundColor: "#f5f8f9" } : {}]}>
          {row.map((cell, cellIndex) => (
            <View key={cellIndex} style={[styles.tableCell, compact ? styles.compactCell : {}, { width: widths[cellIndex] }]}>
              {typeof cell === "string" ? <Text>{cell}</Text> : <View style={styles.tableParty}><View style={[styles.partyDot, { backgroundColor: cell.color ?? colors.cyan }]} /><Text>{cell.text}</Text></View>}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function blocShare(shares: Record<string, number>, bloc: ProjectionBloc, data: SeatProjectionData) {
  return data.parties.reduce((sum, party) => sum + (party.bloc === bloc ? shares[party.code] ?? 0 : 0), 0);
}

export default function SeatProjectionPdf(props: SeatProjectionPdfProps) {
  const { data, projection, support, reportDate, logoSrc, pollError, localVariation, previousResultWeight, tacticalVoting, interBlocTacticalVoting } = props;
  const totalSeats = projection.constituencies.reduce((sum, constituency) => sum + constituency.seats, 0);
  const activeCodes = new Set(projection.constituencies.flatMap((constituency) => constituency.projected.map((party) => party.code)));
  const partyByCode = new Map(data.parties.map((party) => [party.code, party]));
  const seatRows = projection.standings.map((party) => [
    { text: `${party.code} · ${party.name}`, color: party.color },
    `${party.projectedShare.toFixed(1)}%`,
    String(party.seats),
    String(party.medianSeats),
    `${party.lowSeats}–${party.highSeats}`,
    `${party.largestPartyProbability.toFixed(1)}%`,
  ]);

  return (
    <Document title="Ireland Votes · Northern Ireland Westminster seat projection" author="Ireland Votes" subject="Constituency seat projection scenario">
      <Page size="A4" style={styles.cover}>
        <View style={styles.coverTop}><Image src={logoSrc} style={styles.coverLogo} /><Text style={styles.coverTag}>ELECTORAL ANALYSIS</Text></View>
        <View style={styles.coverMain}>
          <Text style={styles.coverEyebrow}>Northern Ireland · Westminster</Text>
          <Text style={styles.coverTitle}>Seat projection report</Text>
          <Text style={styles.coverDeck}>A constituency-by-constituency scenario for projected vote share, seat outcomes and estimated win probabilities.</Text>
          <View style={styles.coverAccent} />
          <View style={styles.coverFacts}>
            <View style={styles.coverFact}><Text style={styles.coverFactLabel}>CONSTITUENCIES</Text><Text style={styles.coverFactValue}>{data.constituencies.length}</Text></View>
            <View style={styles.coverFact}><Text style={styles.coverFactLabel}>PROJECTED SEATS</Text><Text style={styles.coverFactValue}>{totalSeats}</Text></View>
            <View style={styles.coverFact}><Text style={styles.coverFactLabel}>SIMULATION RUNS</Text><Text style={styles.coverFactValue}>{projection.iterations.toLocaleString()}</Text></View>
          </View>
        </View>
        <View style={styles.coverBottom}><Text style={styles.coverDisclaimer}>Scenario estimate · Not an official forecast</Text><Text style={styles.coverDate}>{reportDate}</Text></View>
      </Page>

      <Page size="A4" style={styles.page}>
        <Header logoSrc={logoSrc} section="01 · Executive summary" /><Footer reportDate={reportDate} />
        <Text style={styles.eyebrow}>01 / EXECUTIVE SUMMARY</Text>
        <Text style={styles.title}>National projection</Text>
        <Text style={styles.body}>The scenario inputs below are normalized to 100% for constituency projections. Point seats show the direct projection; the ranges summarize variation across simulations.</Text>
        <View style={styles.metricRow}>
          <View style={styles.metric}><Text style={styles.metricLabel}>BASELINE ELECTION</Text><Text style={styles.metricValue}>{data.electionLabel}</Text></View>
          <View style={styles.metric}><Text style={styles.metricLabel}>SEATS IN SCOPE</Text><Text style={styles.metricValue}>{totalSeats}</Text></View>
          <View style={styles.metric}><Text style={styles.metricLabel}>MODEL RUNS</Text><Text style={styles.metricValue}>{projection.iterations.toLocaleString()}</Text></View>
        </View>
        <Text style={styles.subheading}>Party outlook</Text>
        <ReportTable headers={["Party", "Vote share", "Point seats", "Median", "Middle 80%", "Most seats"]} widths={["31%", "15%", "14%", "12%", "15%", "13%"]} rows={seatRows} />
        <Text style={styles.subheading}>Scenario inputs</Text>
        <View style={styles.inputGrid}>{data.parties.map((party) => <View key={party.code} style={styles.inputChip}><Text style={styles.inputLabel}>{party.code}</Text><Text style={styles.inputValue}>{(Number(support[party.code]) || 0).toFixed(1)}%</Text></View>)}</View>
        <Text style={styles.subheading}>Projected geography</Text>
        <View style={styles.mapColumn}>
          <Svg style={styles.map} viewBox="0 0 420 520">
            {data.mapFeatures.map((feature) => {
              const seat = projection.constituencies.find((item) => item.name === feature.name);
              return <Path key={feature.name} d={feature.path} fill={partyByCode.get(seat?.winner ?? "")?.color ?? "#dbe2e4"} stroke="#ffffff" strokeWidth={2} />;
            })}
          </Svg>
          <View style={styles.mapLegend}>{data.parties.filter((party) => activeCodes.has(party.code)).map((party) => <View key={party.code} style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: party.color }]} /><Text style={styles.legendText}>{party.code}</Text></View>)}</View>
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        <Header logoSrc={logoSrc} section="02 · Method and assumptions" /><Footer reportDate={reportDate} />
        <Text style={styles.eyebrow}>02 / METHOD AND ASSUMPTIONS</Text>
        <Text style={styles.title}>How to read this scenario</Text>
        <Text style={styles.body}>This report models how national support, constituency history, candidate availability and tactical assumptions combine to produce seat level estimates. It should be read as a transparent scenario, not a point prediction of voter behaviour.</Text>
        <Text style={styles.subheading}>Projection method</Text>
        <Text style={styles.body}>National party support is grouped into Nationalist, Unionist and Non-aligned blocs. Nationalist and Unionist movement is modelled independently; the Non-aligned bloc absorbs the balancing change. Constituency bloc strength blends current local-versus-national differences with historical differences. Party support is then allocated within each bloc using national support and constituency-specific historical strength. When an included party has no 2024 local vote, its starting share uses scenario national support and historical local-versus-national performance, with a small positive floor when national support is non-zero.</Text>
        <Text style={styles.subheading}>Candidate availability and tactical voting</Text>
        <Text style={styles.body}>Only parties included as contesting a constituency can win it. If a bloc has no included party in a constituency, its share is redistributed across blocs that do have an included party. Within-bloc consolidation moves the configured share from other included parties to the strongest projected party in that bloc. Inter-bloc tactical movement is allowed between Nationalist and Non-aligned, and between Unionist and Non-aligned. Direct Nationalist–Unionist transfers are excluded. These settings are scenario assumptions and do not model individual voter behaviour or local candidate appeal.</Text>
        <Text style={styles.subheading}>Historical local signal</Text>
        <Text style={styles.body}>The latest Westminster result remains the anchor for parties with a recorded 2024 local vote. Constituency-versus-national results from Westminster 2019, 2017 and 2015 inform local strength and swing response; Westminster contributes 75% of the swing adjustment, weighted 50%, 30% and 20% within that source. NI Assembly first-preference results from 2022 and 2017 contribute the remaining 25%, weighted 70% and 30%. For an included party without a 2024 local vote, historical local-versus-national strength adjusts its national-support starting share. Assembly results are treated as a separate signal because the electoral system differs from Westminster first-past-the-post. Belfast South history is used as a proxy for Belfast South and Mid Down because of boundary changes.</Text>
        <Text style={styles.subheading}>Simulation and uncertainty</Text>
        <Text style={styles.body}>The model runs {projection.iterations.toLocaleString()} simulations. Polling uncertainty ({pollError.toFixed(1)} points) is applied independently to Nationalist and Unionist national support. Constituency variation ({localVariation.toFixed(1)} points) is applied to local bloc estimates and party shares within each bloc. Seat ranges show the middle 80% of simulations. Win chances use light smoothing and are not yet calibrated against historical forecasts.</Text>
        <Text style={styles.subheading}>Settings used in this report</Text>
        <Text style={styles.body}>Historical swing influence: {previousResultWeight}%. Within-bloc consolidation: Nationalist {tacticalVoting.Nationalist}%, Unionist {tacticalVoting.Unionist}%, Non-aligned {tacticalVoting["Non-aligned"]}%. Inter-bloc flows: Nationalist to Non-aligned {interBlocTacticalVoting.nationalistToNonAligned}%; Non-aligned to Nationalist {interBlocTacticalVoting.nonAlignedToNationalist}%; Unionist to Non-aligned {interBlocTacticalVoting.unionistToNonAligned}%; Non-aligned to Unionist {interBlocTacticalVoting.nonAlignedToUnionist}%. No direct Nationalist–Unionist transfers.</Text>
        <View style={styles.note}><Text style={styles.body}>Interpretation note: estimated win chances describe outcomes within the model’s simulated scenarios. They do not account for every source of polling, candidate or campaign uncertainty.</Text></View>
      </Page>

      {projection.constituencies.map((constituency, index) => {
        const winner = partyByCode.get(constituency.winner);
        const runnerUp = partyByCode.get(constituency.runnerUp);
        const currentRows = constituency.projected.map((party) => {
          const definition = partyByCode.get(party.code);
          return [
            { text: `${party.code} · ${definition?.name ?? party.code}`, color: definition?.color },
            `${party.share.toFixed(1)}%`,
            `${(constituency.winProbability[party.code] ?? 0).toFixed(1)}%`,
            `${(constituency.partyShares[party.code] ?? 0).toFixed(1)}%`,
          ];
        });
        const historicalRows = constituency.projected.map((party) => [
          party.code,
          constituency.historicalPartyShares["2019"][party.code] === undefined ? "—" : `${constituency.historicalPartyShares["2019"][party.code].toFixed(1)}%`,
          constituency.historicalPartyShares["2017"][party.code] === undefined ? "—" : `${constituency.historicalPartyShares["2017"][party.code].toFixed(1)}%`,
          constituency.historicalPartyShares["2015"][party.code] === undefined ? "—" : `${constituency.historicalPartyShares["2015"][party.code].toFixed(1)}%`,
          `${(constituency.assemblyPartyShares["2022"][party.code] ?? 0).toFixed(1)}%`,
          `${(constituency.assemblyPartyShares["2017"][party.code] ?? 0).toFixed(1)}%`,
        ]);
        const blocRows = PROJECTION_BLOCS.map((bloc) => [
          bloc,
          `${constituency.projectedBlocShares[bloc].toFixed(1)}%`,
          `${constituency.blocShares[bloc].toFixed(1)}%`,
          `${blocShare(constituency.historicalPartyShares["2019"], bloc, data).toFixed(1)}%`,
          `${blocShare(constituency.historicalPartyShares["2017"], bloc, data).toFixed(1)}%`,
          `${blocShare(constituency.assemblyPartyShares["2017"], bloc, data).toFixed(1)}%`,
          `${blocShare(constituency.assemblyPartyShares["2022"], bloc, data).toFixed(1)}%`,
          `${tacticalVoting[bloc]}%`,
        ]);
        return (
          <Page key={constituency.name} size="A4" style={styles.page}>
            <Header logoSrc={logoSrc} section={`03 · Constituency ${String(index + 1).padStart(2, "0")}`} /><Footer reportDate={reportDate} />
            <Text style={styles.eyebrow}>03 / CONSTITUENCY PROJECTION · {String(index + 1).padStart(2, "0")} OF {projection.constituencies.length}</Text>
            <Text style={styles.title}>{constituency.name}</Text>
            <View style={[styles.winnerPanel, { borderLeftColor: winner?.color ?? colors.cyan }]}>
              <Text style={styles.winnerLabel}>Projected winner</Text>
              <Text style={styles.winnerName}>{winner?.name ?? "No included candidate"}</Text>
              <Text style={styles.winnerChance}>{winner ? `${(constituency.winProbability[constituency.winner] ?? 0).toFixed(1)}% estimated win chance` : "No candidate selected"}</Text>
            </View>
            <View style={styles.seatMetrics}>
              <View style={styles.seatMetric}><Text style={styles.seatMetricLabel}>Projected lead</Text><Text style={styles.seatMetricValue}>{constituency.margin.toFixed(1)} pts</Text></View>
              <View style={styles.seatMetric}><Text style={styles.seatMetricLabel}>Runner-up</Text><Text style={styles.seatMetricValue}>{runnerUp?.code ?? "—"} · {constituency.projected[1]?.share.toFixed(1) ?? "0.0"}%</Text></View>
              <View style={styles.seatMetric}><Text style={styles.seatMetricLabel}>Candidates included</Text><Text style={styles.seatMetricValue}>{constituency.projected.length}</Text></View>
            </View>
            <View style={styles.sectionBlock}>
              <Text style={[styles.subheading, styles.compactHeading]}>Current scenario</Text>
              <ReportTable compact headers={["Party", "Projected vote", "Win chance", "2024 Westminster"]} widths={["40%", "20%", "20%", "20%"]} rows={currentRows} />
            </View>
            <View style={styles.sectionBlock}>
              <Text style={[styles.subheading, styles.compactHeading]}>Historical party results</Text>
              <ReportTable compact headers={["Party", "2019 HOC", "2017 HOC", "2015 HOC", "2022 Assembly", "2017 Assembly"]} widths={["24%", "14%", "14%", "14%", "17%", "17%"]} rows={historicalRows} />
            </View>
            <View style={styles.sectionBlock}>
              <Text style={[styles.subheading, styles.compactHeading]}>Bloc fundamentals</Text>
              <ReportTable compact headers={["Bloc", "Projected", "2024 HOC", "2019 HOC", "2017 HOC", "2017 Assy", "2022 Assy", "Tactical"]} widths={["19%", "12%", "12%", "12%", "12%", "12%", "12%", "9%"]} rows={blocRows} />
            </View>
            <Text style={styles.body}>Historical Westminster local-versus-national results and NI Assembly first preferences inform within-bloc strength. Parties not included in this scenario are omitted and cannot win this constituency. Tactical consolidation is applied only within the configured bloc; the inter-bloc settings are described in the methodology section.</Text>
          </Page>
        );
      })}
    </Document>
  );
}
