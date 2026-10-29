export type PartyDefinition = {
  code: string;
  name: string;
  graphicName?: string;
  color: string;
  affiliation: string;
};

export type ElectionComparison = {
  id: string;
  label: string;
  partyShares: Record<string, number>;
};

export type LatestPollSnapshot = {
  date: string;
  sample: number | null;
  pollster: string;
  commissioner: string;
  partyShares: Record<string, number>;
  history: Array<{
    date: string;
    pollster: string;
    commissioner: string;
    partyShares: Record<string, number>;
  }>;
};

export type GraphicTemplateKey = "polling" | "breaking-news" | "on-this-day" | "election-results" | "explainer";
export type ElectionArchiveCandidate = { name: string; party: string; votes: number; share: number; status: string };
export type ElectionArchiveArea = {
  name: string;
  seats: number | null;
  turnout: number | null;
  candidates: ElectionArchiveCandidate[];
  parties: Array<{ code: string; votes: number; share: number; elected: number }>;
};
export type ElectionArchiveEntry = { id: string; label: string; date: string | null; areas: ElectionArchiveArea[] };

export type PollingGraphicOptions = {
  pollsters: string[];
  commissioners: string[];
  elections: ElectionComparison[];
  electionArchive: ElectionArchiveEntry[];
  latestPolls: {
    dail: LatestPollSnapshot | null;
    niAssembly: LatestPollSnapshot | null;
  };
};

export const PARTY_CATALOG: PartyDefinition[] = [
  { code: "FF", name: "Fianna F\u00e1il", graphicName: "Fianna F\u00e1il", color: "#66bb6a", affiliation: "Renew Europe" },
  { code: "FG", name: "Fine Gael", graphicName: "Fine Gael", color: "#5c6bc0", affiliation: "European People's Party" },
  { code: "SF", name: "Sinn F\u00e9in", graphicName: "Sinn F\u00e9in", color: "#124940", affiliation: "The Left" },
  { code: "SD", name: "Social Democrats", graphicName: "Social Dem", color: "#741d83", affiliation: "Socialists & Democrats" },
  { code: "LAB", name: "Labour", graphicName: "Labour", color: "#e53935", affiliation: "Socialists & Democrats" },
  { code: "AON", name: "Aont\u00fa", graphicName: "Aont\u00fa", color: "#53660e", affiliation: "\u2014" },
  { code: "INDIRL", name: "Independent Ireland", graphicName: "Ind. Ireland", color: "#9be736", affiliation: "Renew Europe" },
  { code: "GP", name: "Green Party", graphicName: "Green Party", color: "#43a047", affiliation: "Greens / European Free Alliance" },
  { code: "PBPS", name: "People Before Profit\u2013Solidarity", graphicName: "PBP-Sol.", color: "#da1498", affiliation: "The Left" },
  { code: "REN", name: "Renua Ireland", color: "#d6960b", affiliation: "—" },
  { code: "IA", name: "Independent Alliance", color: "#7a7a7a", affiliation: "—" },
  { code: "PD", name: "People Before Profit", color: "#da1498", affiliation: "The Left" },
  { code: "IND", name: "Independent", color: "#7a7a7a", affiliation: "—" },
  { code: "I4C", name: "Ireland for Change", color: "#e2a8a8", affiliation: "—" },
  { code: "IPP", name: "Irish People Party", color: "#0e9775", affiliation: "—" },
  { code: "SDLP", name: "SDLP", color: "#fd281b", affiliation: "Socialists & Democrats" },
  { code: "PBP", name: "People Before Profit", color: "#da1498", affiliation: "The Left" },
  { code: "DUP", name: "DUP", color: "#dd5454", affiliation: "—" },
  { code: "UUP", name: "UUP", color: "#3676c0", affiliation: "—" },
  { code: "TUV", name: "TUV", color: "#0a244b", affiliation: "—" },
  { code: "AP", name: "Alliance", graphicName: "Alliance", color: "#fdd835", affiliation: "—" },
  { code: "INDN", name: "Independent Nationalist", color: "#0c4257", affiliation: "—" },
  { code: "INDU", name: "Independent Unionist", color: "#d65f30", affiliation: "—" },
  { code: "CON", name: "Conservative", color: "#0a3f8f", affiliation: "—" },
  { code: "PUP", name: "PUP", color: "#090ca8", affiliation: "—" },
  { code: "UKIP", name: "UKIP", color: "#580454", affiliation: "—" },
  { code: "IFP", name: "Irish Freedom Party", color: "#095f18", affiliation: "—" },
  { code: "NP", name: "National Party", color: "#052e1d", affiliation: "—" },
  { code: "RTC", name: "Right To Change", color: "#db2f2f", affiliation: "—" },
  { code: "SP", name: "Socialist Party", color: "#9c0e0e", affiliation: "The Left" },
  { code: "AAA", name: "Anti-Austerity Alliance", color: "#c7c414", affiliation: "The Left" },
  { code: "RED", name: "Renua / other", color: "#7a7a7a", affiliation: "—" },
];

export const PARTY_BY_CODE = Object.fromEntries(
  PARTY_CATALOG.map((party) => [party.code, party]),
) as Record<string, PartyDefinition>;

export const DEFAULT_POLLING_PARTY_CODES = [
  "FF", "FG", "SF", "SD", "LAB", "AON", "INDIRL", "GP", "PBPS",
];

