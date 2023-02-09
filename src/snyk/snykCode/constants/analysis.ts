export const SNYK_SEVERITIES: { [key: string]: number } = {
  information: 1,
  warning: 2,
  error: 3,
};

export const IGNORE_ISSUE_BASE_COMMENT_TEXT = 'deepcode ignore';

export const FILE_IGNORE_ISSUE_BASE_COMMENT_TEXT = `file ${IGNORE_ISSUE_BASE_COMMENT_TEXT}`;

export const IGNORE_ISSUE_REASON_TIP = '<please specify a reason of ignoring this>';

export const SHOW_ISSUE_ACTION_NAME = 'Show this suggestion (Snyk)';
export const IGNORE_ISSUE_ACTION_NAME = 'Ignore this particular suggestion (Snyk)';
export const FILE_IGNORE_ACTION_NAME = 'Ignore this suggestion in current file (Snyk)';
export const IGNORE_TIP_FOR_USER = "To ignore this issue for Snyk choose 'Ignore this issue' in QuickFix dropdown";

export const ISSUES_MARKERS_DECORATION_TYPE: { [key: string]: string } = {
  border: '1px',
  borderColor: 'green',
  borderStyle: 'none none dashed none',
};

export const DIAGNOSTICS_CODE_SECURITY_COLLECTION_NAME = 'Snyk Code Security';
export const DIAGNOSTICS_CODE_QUALITY_COLLECTION_NAME = 'Snyk Code Quality';
export const DIAGNOSTICS_OSS_COLLECTION_NAME = 'Snyk Open Source Security';

export const WEBVIEW_PANEL_SECURITY_TITLE = 'Snyk Code Vulnerability';
export const WEBVIEW_PANEL_QUALITY_TITLE = 'Snyk Code Issue';
