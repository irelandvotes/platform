type LiveSheetConfig = {
  tally: string;
  official?: string;
};

export const liveSheetMap:
Record<string, LiveSheetConfig> = {

  "ireland-dail-2026-dublin-central": {

     tally:
      "",

     official:
      "https://docs.google.com/spreadsheets/d/1xuBzJQ0Fje8iEDc50gvb6iSCg1-1bZen87yFwUXrhXw/export?format=csv"
  },

  "ireland-dail-2026-galway-west": {

     tally:
      "",

     official:
      "https://docs.google.com/spreadsheets/d/1CpAo88EitVbmKT47bFlmonhCZ4sb_wOYM4SKx-pWegE/export?format=csv"
  }

};