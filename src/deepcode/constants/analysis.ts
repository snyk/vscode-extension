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

export const IGNORE_ISSUE_COMMENT_TEXT = "// DEEPCODE IGNORE TEST LINE";
export const IGNORE_ISSUE_ACTION_NAME = "Ignore this issue(Deepcode)";
export const IGNORE_TIP_FOR_USER =
  "To ignore this issue choose 'Ignore this issue' in QuickFix dropdown";
