export const SNYK_SEVERITIES: { [key: string]: number } = {
  information: 1,
  warning: 2,
  error: 3
};

export const IGNORE_ISSUE_BASE_COMMENT_TEXT: string = "snyk ignore";

export const FILE_IGNORE_ISSUE_BASE_COMMENT_TEXT: string = `file ${IGNORE_ISSUE_BASE_COMMENT_TEXT}`;

export const IGNORE_ISSUE_REASON_TIP: string =
  "<please specify a reason of ignoring this>";

export const SHOW_ISSUE_ACTION_NAME: string =
  "Show this suggestion (Snyk)";
export const IGNORE_ISSUE_ACTION_NAME: string =
  "Ignore this particular suggestion (Snyk)";
export const FILE_IGNORE_ACTION_NAME: string =
  "Ignore this suggestion in current file (Snyk)";
export const IGNORE_TIP_FOR_USER: string =
  "To ignore this issue for Snyk choose 'Ignore this issue' in QuickFix dropdown";

export const ISSUES_MARKERS_DECORATION_TYPE: { [key: string]: string } = {
  border: "1px",
  borderColor: "green",
  borderStyle: "none none dashed none"
};
