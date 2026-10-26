export const PROJECTION_BLOCS = ["Nationalist", "Unionist", "Non-aligned"] as const;
export type ProjectionBloc = typeof PROJECTION_BLOCS[number];

const PARTY_BLOC: Record<string, ProjectionBloc> = {
  SF: "Nationalist",
  SDLP: "Nationalist",
  AON: "Nationalist",
  PBP: "Nationalist",
  PD: "Nationalist",
  INDN: "Nationalist",
  WP: "Nationalist",
  DUP: "Unionist",
  UUP: "Unionist",
  TUV: "Unionist",
  INDU: "Unionist",
  PUP: "Unionist",
  CON: "Unionist",
  UKIP: "Unionist",
};

export function getProjectionBloc(partyCode: string): ProjectionBloc {
  return PARTY_BLOC[partyCode] ?? "Non-aligned";
}
