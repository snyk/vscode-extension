export const ANALYSIS_STATUS: { [key: string]: string } = {
  fetching: "FETCHING",
  analyzing: "ANALYZING",
  dcDone: "DC_DONE",
  done: "DONE",
  failed: "FAILED"
};

export const DEEPCODE_SEVERITIES: { [key: string]: number } = {
  information: 1,
  warning: 2,
  error: 3
};
