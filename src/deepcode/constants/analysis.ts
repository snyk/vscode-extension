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

export const IGNORE_ISSUE_BASE_COMMENT_TEXT: string = "deepcode ignore";

export const GLOBAL_IGNORE_ISSUE_BASE_COMMENT_TEXT: string = `global ${IGNORE_ISSUE_BASE_COMMENT_TEXT}`;

export const IGNORE_ISSUE_REASON_TIP: string =
  "<please specify a reason of ignoring this>";

export const IGNORE_ISSUE_ACTION_NAME: string =
  "Ignore this issue for DeepCode";
export const GLOBAL_IGNORE_ACTION_NAME: string =
  "Ignore this issue globally for DeepCode";
export const IGNORE_TIP_FOR_USER: string =
  "To ignore this issue for DeepCode choose 'Ignore this issue' in QuickFix dropdown";

export const ISSUES_MARKERS_DECORATION_TYPE: { [key: string]: string } = {
  border: "1px",
  borderColor: "green",
  borderStyle: "none none dashed none"
};

export const ISSUE_ID_SPLITTER = "%2Fdc%2F";
