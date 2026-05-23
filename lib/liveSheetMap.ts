type LiveSheetConfig = {
  tally: string;
  official?: string;
};

export const liveSheetMap:
Record<string, LiveSheetConfig> = {

  "ireland-dail-2026-galway-west": {

     tally:
      "https://docs.google.com/spreadsheets/d/1wIPwSuSbD-L-2Iei7rYbetCVo3T0BsoaMStc7PUlLGU/export?format=csv",

     official:
      "https://docs.google.com/spreadsheets/d/1CpAo88EitVbmKT47bFlmonhCZ4sb_wOYM4SKx-pWegE/export?format=csv"
  }

};