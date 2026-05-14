export const partyIdeology: Record<string, string> = {

  PBPS: "far-left",

  SF: "left",

  LAB: "centre-left",
  SD: "centre-left",
  GP: "centre-left",

  FF: "centre",
  IND: "centre",
  INDIRL: "centre",
  AON: "centre",

  FG: "centre-right",

  REN: "right",

  IFP: "far-right",
  IPP: "far-right",
  NP: "far-right"

};

export const ideologyDistance: Record<string, number> = {
  "far-left": 0,
  "left": 1,
  "centre-left": 2,
  "centre": 3,
  "centre-right": 4,
  "right": 5,
  "far-right": 6
};

export function isLikeMinded(
  partyA: string,
  partyB: string
) {

  const a =
    ideologyDistance[
      partyIdeology[partyA] || "centre"
    ];

  const b =
    ideologyDistance[
      partyIdeology[partyB] || "centre"
    ];

  return Math.abs(a - b) <= 1;

}