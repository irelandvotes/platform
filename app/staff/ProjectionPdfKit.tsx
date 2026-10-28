import { Defs, Font, Image, Line, LinearGradient, Page, Rect, Stop, Svg, Text, View } from "@react-pdf/renderer";

Font.register({
  family: "Averta",
  fonts: [
    { src: "/fonts/AvertaPdf-Regular.ttf", fontWeight: 400 },
    { src: "/fonts/AvertaPdf-Semibold.ttf", fontWeight: 600 },
    { src: "/fonts/AvertaPdf-Bold.ttf", fontWeight: 700 },
  ],
});

export const PDF_COLORS = {
  ink: "#181818",
  dark: "#181818",
  cyan: "#00dfef",
  cyanLight: "#8cf7ff",
  paper: "#f8f8f8",
  line: "#dce5e7",
  muted: "#68787d",
  white: "#ffffff",
  green: "#287a59",
  red: "#ad4f55",
};

export const PDF_STYLES = {
  page: { paddingTop: 62, paddingBottom: 48, paddingHorizontal: 42, color: PDF_COLORS.ink, fontFamily: "Averta", fontSize: 8 },
  frontMatterPage: { paddingTop: 80, paddingBottom: 48, paddingHorizontal: 42, color: PDF_COLORS.ink, fontFamily: "Averta", fontSize: 8 },
  header: { position: "absolute" as const, top: 0, left: 0, right: 0, height: 42, paddingHorizontal: 38, backgroundColor: "#11191b", flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const },
  headerLogo: { width: 96, height: 28, objectFit: "contain" as const, objectPosition: "left center" as const },
  headerText: { color: "#c0d0d2", fontSize: 6.5, letterSpacing: 1, textTransform: "uppercase" as const },
  footer: { position: "absolute" as const, left: 38, right: 38, bottom: 16, flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "center" as const, borderTopWidth: 1, borderTopColor: PDF_COLORS.line, paddingTop: 6 },
  footerText: { color: "#829094", fontSize: 6.5, letterSpacing: 0.5 },
  pageNumber: { color: PDF_COLORS.ink, fontSize: 7.5, fontWeight: 700 },
  eyebrow: { marginBottom: 4, color: "#008894", fontSize: 6.5, fontWeight: 700, letterSpacing: 1.15, textTransform: "uppercase" as const },
  title: { marginBottom: 9, color: PDF_COLORS.ink, fontSize: 22, fontWeight: 700, lineHeight: 1.12, letterSpacing: -0.35 },
  deck: { marginBottom: 12, color: PDF_COLORS.muted, fontSize: 8, lineHeight: 1.5, textAlign: "justify" as const },
  section: { marginTop: 12, marginBottom: 6, color: PDF_COLORS.ink, fontSize: 10, fontWeight: 700 },
  smallSection: { marginTop: 6, marginBottom: 3, color: PDF_COLORS.ink, fontSize: 8, fontWeight: 700 },
  metrics: { flexDirection: "row" as const, gap: 7, marginVertical: 10 },
  metric: { flexGrow: 1, flexBasis: 0, padding: 8, borderWidth: 1, borderColor: PDF_COLORS.line, borderRadius: 4, backgroundColor: "#f8fafb" },
  metricLabel: { color: PDF_COLORS.muted, fontSize: 6, letterSpacing: 0.45 },
  metricValue: { marginTop: 3, color: PDF_COLORS.ink, fontSize: 12, fontWeight: 700 },
  table: { width: "100%", marginTop: 3, borderWidth: 1, borderColor: PDF_COLORS.line, borderRadius: 3 },
  row: { minHeight: 20, flexDirection: "row" as const, alignItems: "center" as const, borderBottomWidth: 0.5, borderBottomColor: PDF_COLORS.line },
  tableHead: { minHeight: 24, backgroundColor: PDF_COLORS.dark },
  cell: { minWidth: 0, flexShrink: 1, paddingVertical: 4, paddingHorizontal: 4, color: PDF_COLORS.ink, fontSize: 7, lineHeight: 1.25 },
  headCell: { color: PDF_COLORS.white, fontSize: 6.2, fontWeight: 700 },
  partyCell: { flexDirection: "row" as const, alignItems: "center" as const, gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 2 },
  note: { marginTop: 10, padding: 9, borderLeftWidth: 3, borderLeftColor: PDF_COLORS.cyan, borderRadius: 2, backgroundColor: "#e9f7f8" },
  noteText: { color: PDF_COLORS.muted, fontSize: 7.2, lineHeight: 1.45, textAlign: "justify" as const },
  panel: { padding: 8, borderWidth: 1, borderColor: PDF_COLORS.line, borderRadius: 4, backgroundColor: "#fbfcfc" },
};

function romanNumeral(number: number) {
  const values: Array<[number, string]> = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let remainder = Math.max(1, number);
  return values.reduce((result, [value, numeral]) => {
    while (remainder >= value) { result += numeral; remainder -= value; }
    return result;
  }, "").toLowerCase();
}

function PdfGraphicAtmosphere() {
  return <Image src="/projection-report-atmosphere.png" style={{ position: "absolute", top: 0, left: 0, width: 595, height: 840 }} />;
}

export function PdfCoverPage({ logo, date }: { logo: string; date: string }) {
  return <Page size="A4" style={{ padding: 0, fontFamily: "Averta", backgroundColor: "#11191b" }}>
    <PdfGraphicAtmosphere />
    <Image src={logo} style={{ position: "absolute", top: 25, left: 30, width: 172, height: 72, objectFit: "contain", objectPosition: "left center" }} />
    <Text style={{ position: "absolute", left: 42, right: 34, top: 280, color: "#f4f8f8", fontSize: 47, fontWeight: 700, lineHeight: 1.02, textAlign: "left", letterSpacing: -1.8 }}>Confidential{"\n"}Projection{"\n"}Report</Text>
    <Text style={{ position: "absolute", left: 42, right: 34, bottom: 34, color: "#b8c8ca", fontSize: 8, letterSpacing: 0.7, textAlign: "left" }}>PREPARED  /  {date.toUpperCase()}</Text>
  </Page>;
}

export function PdfFrontMatterChrome({ logo, label }: { logo: string; label: string }) {
  return <>
    <View fixed style={{ position: "absolute", top: 0, left: 0, right: 0, height: 50, paddingHorizontal: 38, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#11191b" }}>
      <Image src="/projection-report-header-atmosphere.png" style={{ position: "absolute", top: 0, right: 0, width: 300, height: 50 }} />
      <Image src={logo} style={{ width: 104, height: 31, objectFit: "contain", objectPosition: "left center" }} />
      <Text style={{ color: "#d5e1e2", fontSize: 6.5, letterSpacing: 0.9 }}>{label.toUpperCase()}</Text>
    </View>
    <View fixed style={{ position: "absolute", bottom: 17, left: 38, right: 38, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: PDF_COLORS.line, paddingTop: 6 }}>
      <Text style={PDF_STYLES.footerText}>IRELAND VOTES  /  CONFIDENTIAL</Text>
      <Text style={PDF_STYLES.pageNumber} render={({ pageNumber }) => romanNumeral(pageNumber - 1)} />
    </View>
  </>;
}

export function PdfChrome({ logo, label, date, pageOffset = 5 }: { logo: string; label: string; date: string; pageOffset?: number }) {
  return <>
    <View fixed style={PDF_STYLES.header}><Image src="/projection-report-header-atmosphere.png" style={{ position: "absolute", top: 0, right: 0, width: 252, height: 42 }} /><Image src={logo} style={PDF_STYLES.headerLogo} /><Text style={PDF_STYLES.headerText}>{label}</Text></View>
    <View fixed style={PDF_STYLES.footer}>
      <Text style={PDF_STYLES.footerText}>IRELAND VOTES  /  CONFIDENTIAL SCENARIO  /  {date}</Text>
      <Text style={PDF_STYLES.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber - pageOffset} / ${totalPages - pageOffset - 1}`} />
    </View>
  </>;
}

export function PdfSectionDivider({ logo, date, number, title, pageOffset = 5 }: {
  logo: string; date: string; number: string; title: string; deck: string; pageOffset?: number;
}) {
  return <Page size="A4" style={{ padding: 42, backgroundColor: PDF_COLORS.ink, color: PDF_COLORS.white, fontFamily: "Averta", justifyContent: "space-between" }}>
    <View style={{ flexDirection: "row", justifyContent: "flex-start", alignItems: "center" }}>
      <View style={{ paddingHorizontal: 9, paddingVertical: 5, borderRadius: 3, backgroundColor: PDF_COLORS.dark }}><Image src={logo} style={{ width: 142, height: 42, objectFit: "contain", objectPosition: "left center" }} /></View>
    </View>
    <View>
      <Text style={{ color: "#2d4b50", fontSize: 112, fontWeight: 700, lineHeight: 0.9 }}>{number}</Text>
      <View style={{ width: 68, height: 4, marginTop: 14, marginBottom: 18, backgroundColor: PDF_COLORS.cyan }} />
      <Text style={{ maxWidth: 430, color: PDF_COLORS.white, fontSize: 34, fontWeight: 700, lineHeight: 1.04 }}>{title}</Text>
    </View>
    <View style={{ flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: "#43575b", paddingTop: 10 }}>
      <Text style={{ color: "#aebfc1", fontSize: 7 }}>IRELAND VOTES  /  {date}</Text><Text style={{ color: "#aebfc1", fontSize: 7 }} render={({ pageNumber, totalPages }) => `${pageNumber - pageOffset} / ${totalPages - pageOffset - 1}`} />
    </View>
  </Page>;
}

export type PdfContentsSection = { number: string; title: string; topics: Array<string | { label: string; page: number }>; page: number; entries?: Array<{ label: string; page: number }> };
export function PdfContentsPage({ logo, sections }: { logo: string; sections: PdfContentsSection[]; subtitle?: string }) {
  return <Page size="A4" style={PDF_STYLES.frontMatterPage}>
    <PdfFrontMatterChrome logo={logo} label="Report contents" />
    <Text style={PDF_STYLES.title}>Contents</Text>
    <View style={{ marginTop: 8, marginBottom: 5, padding: 9, backgroundColor: "#f2f7f8", borderLeftWidth: 3, borderLeftColor: PDF_COLORS.cyan }}>
      <Text style={{ marginBottom: 4, color: PDF_COLORS.ink, fontSize: 7.5, fontWeight: 700 }}>FRONT MATTER</Text>
      {[{ label: "Confidential", page: "i" }, { label: "Methodology", page: "ii" }, { label: "Inputs and assumptions", page: "iii" }].map((item) => <View key={item.label} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 }}><Text style={{ color: PDF_COLORS.muted, fontSize: 7 }}>{item.label}</Text><Text style={{ color: PDF_COLORS.muted, fontSize: 7 }}>{item.page}</Text></View>)}
    </View>
    {sections.map((section) => <View key={section.number} style={{ marginTop: 12 }} wrap={false}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: PDF_COLORS.line }}>
        <Text style={{ width: 27, color: PDF_COLORS.cyan, fontSize: 15, fontWeight: 700 }}>{section.number}</Text>
        <Text style={{ flexGrow: 1, color: PDF_COLORS.ink, fontSize: 10, fontWeight: 700 }}>{section.title}</Text>
        <Text style={{ width: 24, textAlign: "right", color: PDF_COLORS.ink, fontSize: 8, fontWeight: 700 }}>{section.page}</Text>
      </View>
      {(section.topics.length > 0 || section.entries?.length) ? <View style={{ marginTop: 8 }}>
        {section.topics.map((topic, index) => { const item = typeof topic === "string" ? { label: topic, page: section.page } : topic; return <View key={`${section.number}-topic-${index}`} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, paddingLeft: 37 }}><Text style={{ color: PDF_COLORS.muted, fontSize: 7 }}>{item.label}</Text><Text style={{ color: PDF_COLORS.muted, fontSize: 7 }}>{item.page}</Text></View>; })}
        {section.entries?.map((entry) => <View key={`${section.number}-${entry.label}`} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 2, paddingLeft: 37 }}><Text style={{ color: PDF_COLORS.muted, fontSize: 6.8 }}>{entry.label}</Text><Text style={{ color: PDF_COLORS.muted, fontSize: 6.8 }}>{entry.page}</Text></View>)}
      </View> : null}
    </View>)}
  </Page>;
}

export function PdfNoticePage({ logo, label, title, body }: { logo: string; label: string; eyebrow: string; title: string; body: string[]; accent?: string }) {
  return <Page size="A4" style={PDF_STYLES.frontMatterPage}>
    <PdfFrontMatterChrome logo={logo} label={label} />
    <Text style={[PDF_STYLES.title, { fontSize: 28, marginBottom: 13 }]}>{title}</Text>
    {body.map((paragraph, index) => <Text key={index} style={{ marginBottom: 11, color: PDF_COLORS.muted, fontSize: 9, lineHeight: 1.55, textAlign: "justify" }}>{paragraph}</Text>)}
  </Page>;
}

export function PdfClosingPage({ logo, date, email = "contact@irelandvotes.com", website = "irelandvotes.com" }: { logo: string; date: string; email?: string; website?: string }) {
  return <Page size="A4" style={{ padding: 0, fontFamily: "Averta", backgroundColor: "#11191b" }}>
    <PdfGraphicAtmosphere />
    <Image src={logo} style={{ position: "absolute", top: 25, left: 30, width: 172, height: 72, objectFit: "contain", objectPosition: "left center" }} />
    <Text style={{ position: "absolute", left: 38, top: 222, color: "#91a3a5", fontSize: 8, fontWeight: 700, letterSpacing: 0.85 }}>CONTACT</Text>
    <Text style={{ position: "absolute", left: 38, top: 269, color: "#d4e0e1", fontSize: 7, letterSpacing: -0.15 }}>Glen</Text>
    <Text style={{ position: "absolute", left: 38, top: 282, color: "#00d4df", fontSize: 9, letterSpacing: -0.2 }}>glen@irelandvotes.com</Text>
    <Text style={{ position: "absolute", left: 38, top: 326, color: "#d4e0e1", fontSize: 7, letterSpacing: -0.15 }}>Michael</Text>
    <Text style={{ position: "absolute", left: 38, top: 339, color: "#00d4df", fontSize: 9, letterSpacing: -0.2 }}>michael@irelandvotes.com</Text>
    <Text style={{ position: "absolute", left: 38, top: 383, color: "#d4e0e1", fontSize: 7, letterSpacing: -0.15 }}>General enquiries</Text>
    <Text style={{ position: "absolute", left: 38, top: 396, color: "#00d4df", fontSize: 9, letterSpacing: -0.2 }}>{email}</Text>
    <Text style={{ position: "absolute", left: 38, top: 431, color: "#f4f8f8", fontSize: 8, letterSpacing: -0.15 }}>{website}</Text>
    <Text style={{ position: "absolute", left: 30, bottom: 31, color: "#91a3a5", fontSize: 6.5, letterSpacing: -0.1 }}>CONFIDENTIAL PROJECTION REPORT  /  {date.toUpperCase()}</Text>
  </Page>;
}

export function PdfAcronymIndex({ logo, date, entries }: { logo: string; date: string; entries: Array<{ code: string; name: string }> }) {
  const midpoint = Math.ceil(entries.length / 2);
  const columns = [entries.slice(0, midpoint), entries.slice(midpoint)];
  const fullNames: Record<string, string> = {
    AON: "Aont\u00fa", AP: "Alliance Party", AAA: "Anti-Austerity Alliance", CCLA: "Cross Community Labour Alliance", CISTA: "Cannabis Is Safer Than Alcohol", CON: "Conservative Party",
    DUP: "Democratic Unionist Party", FF: "Fianna F\u00e1il", FG: "Fine Gael", GP: "Green Party", HER: "Heritage Party", I4C: "Ireland for Change",
    IA: "Independent Alliance", IND: "Independent", INDIRL: "Independent Ireland", INDU: "Independent Unionist",
    INDN: "Independent Nationalist", IFP: "Irish Freedom Party", IPP: "Irish People Party", IRS: "Irish Republican Socialists", LAB: "Labour Party",
    NP: "National Party", PBPS: "People Before Profit\u2013Solidarity", PBP: "People Before Profit", PD: "People Before Profit",
    PUP: "Progressive Unionist Party", RED: "Renua / other", REN: "Renua Ireland", RTC: "Right To Change",
    SD: "Social Democrats", SDLP: "Social Democratic and Labour Party", SF: "Sinn F\u00e9in", SP: "Socialist Party",
    TUV: "Traditional Unionist Voice", UKIP: "UK Independence Party", UUP: "Ulster Unionist Party", WP: "Workers' Party",
  };
  return <Page size="A4" style={PDF_STYLES.page}>
    <PdfChrome logo={logo} label="REFERENCE  /  PARTY ACRONYMS" date={date}/>
    <Text style={PDF_STYLES.title}>Party acronym index</Text>
    <View style={{ flexDirection: "row", gap: 22 }}>
      {columns.map((column, columnIndex) => <View key={columnIndex} style={{ flexGrow: 1, flexBasis: 0 }}>
        {column.map((entry) => <View key={entry.code} style={{ flexDirection: "row", paddingVertical: 7, borderBottomWidth: 0.7, borderBottomColor: PDF_COLORS.line }}>
          <Text style={{ width: 48, color: PDF_COLORS.ink, fontSize: 8, fontWeight: 700 }}>{entry.code}</Text>
          <Text style={{ flexGrow: 1, color: PDF_COLORS.muted, fontSize: 8 }}>{fullNames[entry.code] ?? entry.name}</Text>
        </View>)}
      </View>)}
    </View>
  </Page>;
}

export function PdfConstituencyHeading({ name, prominent = false }: { name: string; prominent?: boolean }) {
  if (prominent) return <View style={{ position: "relative", height: 88, marginTop: -20, marginBottom: 12, marginHorizontal: -42 }}>
    <Image src="/projection-constituency-heading-gradient.png" style={{ position: "absolute", top: 0, left: 0, width: 595, height: 88 }} />
    <Text style={{ position: "absolute", left: 42.8, top: 29.8, color: "#07545a", opacity: 0.12, fontSize: 25, fontWeight: 700, lineHeight: 1.1, letterSpacing: -0.6 }}>{name}</Text>
    <Text style={{ position: "absolute", left: 42.35, top: 29.35, color: "#07545a", opacity: 0.18, fontSize: 25, fontWeight: 700, lineHeight: 1.1, letterSpacing: -0.6 }}>{name}</Text>
    <Text style={{ position: "absolute", left: 42, top: 29, color: PDF_COLORS.ink, fontSize: 25, fontWeight: 700, lineHeight: 1.1, letterSpacing: -0.6 }}>{name}</Text>
  </View>;
  return <View style={{ marginBottom: 7, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: PDF_COLORS.line }}>
    <Text style={{ color: PDF_COLORS.ink, fontSize: 10, fontWeight: 700 }}>{name}</Text>
  </View>;
}

export type PdfProbability = { outcome: number; probability: number };
export function PdfDistributionChart({ title, color, mean, standardDeviation, baseline, outcomes, maxOutcome, coloredHeader = false }: {
  title: string; color: string; mean: number; standardDeviation: number; baseline: number; outcomes: PdfProbability[]; maxOutcome: number; coloredHeader?: boolean;
}) {
  const width = 520;
  const height = 150;
  const left = 36;
  const right = 7;
  const top = 13;
  const bottom = 29;
  const plotHeight = height - top - bottom;
  const safeMaxOutcome = Math.max(0, Math.min(200, Math.floor(Number.isFinite(maxOutcome) ? maxOutcome : 0)));
  const safeOutcomes = outcomes.filter((item) => Number.isFinite(item.outcome) && Number.isFinite(item.probability));
  const maxProbability = Math.max(1, ...safeOutcomes.map((item) => item.probability));
  const yMax = Math.max(10, Math.ceil(maxProbability / 10) * 10);
  const slot = (width - left - right) / (safeMaxOutcome + 1);
  const bars = Array.from({ length: safeMaxOutcome + 1 }, (_, outcome) => {
    const probability = safeOutcomes.find((item) => item.outcome === outcome)?.probability ?? 0;
    const barHeight = Math.max(1.4, probability / yMax * plotHeight);
    return { outcome, probability, x: left + outcome * slot + Math.max(0.35, slot * 0.1), y: top + plotHeight - barHeight, width: Math.max(0.7, slot * 0.8), height: barHeight };
  });
  const ticks = [0, Math.round(safeMaxOutcome / 2), safeMaxOutcome].filter((value, index, array) => array.indexOf(value) === index);
  const gradientId = `chart-header-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return <View wrap={false} style={{ width: "100%", minWidth: 0, padding: coloredHeader ? 0 : 7, borderWidth: 1, borderColor: PDF_COLORS.line, borderRadius: 4, backgroundColor: PDF_COLORS.white, overflow: "hidden" }}>
    {coloredHeader ? <>
      <View style={{ position: "relative", width: "100%", height: 29, justifyContent: "center", paddingHorizontal: 8, backgroundColor: "#f1f3f4" }}>
        <Svg width="100%" height={29} viewBox="0 0 520 29" style={{ position: "absolute", top: 0, left: 0 }}>
          <Defs><LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%"><Stop offset="0%" stopColor="#f1f3f4"/><Stop offset="58%" stopColor="#f1f3f4"/><Stop offset="100%" stopColor={color} stopOpacity={0.25}/></LinearGradient></Defs>
          <Rect x={0} y={0} width={520} height={29} fill={`url(#${gradientId})`}/>
        </Svg>
        <Text style={{ color: PDF_COLORS.ink, fontSize: 8.5, fontWeight: 700 }}>{title}</Text>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 8, paddingTop: 5 }}>
        <Text style={{ color: PDF_COLORS.muted, fontSize: 5.9 }}>Mean {mean.toFixed(1)}  /  SD {standardDeviation.toFixed(1)}  /  Base {baseline}</Text>
      </View>
    </> : <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 5 }}>
      <Text style={{ maxWidth: "58%", color, fontSize: 7.3, fontWeight: 700 }}>{title}</Text>
      <Text style={{ color: PDF_COLORS.muted, fontSize: 5.9 }}>Mean {mean.toFixed(1)}  /  SD {standardDeviation.toFixed(1)}  /  Base {baseline}</Text>
    </View>}
    <View style={coloredHeader ? { paddingHorizontal: 8, paddingBottom: 7 } : undefined}>
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ marginTop: 2 }}>
      {[0, 0.5, 1].map((ratio) => {
        const y = top + plotHeight * (1 - ratio);
        return <Line key={ratio} x1={left} y1={y} x2={width - right} y2={y} stroke="#e7edef" strokeWidth={0.7} />;
      })}
      <Line x1={left} y1={top + plotHeight} x2={width - right} y2={top + plotHeight} stroke="#aab8bc" strokeWidth={0.8} />
      <Line x1={left} y1={top} x2={left} y2={top + plotHeight} stroke="#aab8bc" strokeWidth={0.8} />
      {[0, 0.5, 1].map((ratio) => {
        const y = top + plotHeight * (1 - ratio);
        return <Text key={`probability-${ratio}`} x={left - 5} y={y + 2} fill={PDF_COLORS.muted} style={{ fontSize: 6 }} textAnchor="end">{`${Math.round(yMax * ratio)}%`}</Text>;
      })}
      {bars.map((bar) => <Rect key={bar.outcome} x={bar.x} y={bar.y} width={bar.width} height={bar.height} fill={color} opacity={bar.probability === 0 ? 0.22 : 0.86} />)}
      {ticks.map((value) => <Text key={value} x={left + (value + 0.5) * slot} y={height - 14} fill={PDF_COLORS.muted} style={{ fontSize: 7 }} textAnchor="middle">{String(value)}</Text>)}
      <Text x={(left + width - right) / 2} y={height - 2} fill={PDF_COLORS.muted} style={{ fontSize: 6 }} textAnchor="middle">SEATS</Text>
    </Svg>
    </View>
  </View>;
}

export type PdfTableCell = string | { text: string; color?: string };
export function PdfTable({ headers, rows, widths, compact = false, justify = false }: {
  headers: string[]; rows: PdfTableCell[][]; widths: string[]; compact?: boolean; justify?: boolean;
}) {
  return <View style={PDF_STYLES.table}>
    <View style={[PDF_STYLES.row, PDF_STYLES.tableHead]}>
      {headers.map((header, index) => <Text key={`${header}-${index}`} style={[PDF_STYLES.cell, PDF_STYLES.headCell, compact ? { paddingVertical: 3, paddingHorizontal: 3, fontSize: 5.9 } : {}, { width: widths[index] }]}>{header}</Text>)}
    </View>
    {rows.map((row, rowIndex) => <View key={rowIndex} wrap={false} style={[PDF_STYLES.row, compact ? { minHeight: 16 } : {}, rowIndex % 2 ? { backgroundColor: "#f5f8f9" } : {}]}>
      {row.map((cell, cellIndex) => <View key={cellIndex} style={[PDF_STYLES.cell, compact ? { paddingVertical: 3, paddingHorizontal: 3, fontSize: 6.5 } : {}, { width: widths[cellIndex] }]}>
        {typeof cell === "string" ? <Text style={justify ? { textAlign: "justify" } : undefined}>{cell}</Text> : <View style={PDF_STYLES.partyCell}><View style={[PDF_STYLES.dot, { backgroundColor: cell.color ?? PDF_COLORS.cyan }]} /><Text>{cell.text}</Text></View>}
      </View>)}
    </View>)}
  </View>;
}

export function PdfSectionIntro({ number, title }: { number: string; title: string; subtitle?: string }) {
  return <View style={{ marginBottom: 8, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: PDF_COLORS.line }}>
    <Text style={{ color: PDF_COLORS.ink, fontSize: 12, fontWeight: 700, lineHeight: 1.35 }}><Text style={{ color: PDF_COLORS.cyan, fontSize: 13, fontWeight: 700 }}>{number}  </Text>{title}</Text>
  </View>;
}

export function PdfMetric({ label, value, color = PDF_COLORS.ink }: { label: string; value: string; color?: string }) {
  return <View style={PDF_STYLES.metric}><Text style={PDF_STYLES.metricLabel}>{label}</Text><Text style={[PDF_STYLES.metricValue, { color }]}>{value}</Text></View>;
}

export function PdfPartyLabel({ label, color }: { label: string; color: string }) {
  return <View style={PDF_STYLES.partyCell}><View style={[PDF_STYLES.dot, { backgroundColor: color }]} /><Text>{label}</Text></View>;
}

