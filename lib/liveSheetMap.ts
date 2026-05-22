type LiveSheetConfig = {
  tally: string;
  official?: string;
};

export const liveSheetMap:
Record<string, LiveSheetConfig> = {

  "ireland-dail-2026-dublin-central": {

     tally:
      "https://docs.google.com/spreadsheets/d/10M1Aq9D7oxU_asJ9ZGyf7P1qIQEKN6k86tgA0LJmtK8/export?format=csv",

     official:
      "https://docs.google.com/spreadsheets/d/1xuBzJQ0Fje8iEDc50gvb6iSCg1-1bZen87yFwUXrhXw/export?format=csv"
  },

  "ireland-dail-2026-galway-west": {

     tally:
      "https://docs.google.com/spreadsheets/d/1wIPwSuSbD-L-2Iei7rYbetCVo3T0BsoaMStc7PUlLGU/export?format=csv",

     official:
      "https://docs.google.com/spreadsheets/d/1CpAo88EitVbmKT47bFlmonhCZ4sb_wOYM4SKx-pWegE/export?format=csv"
  }

};