export const DEEPCODE_VIEW_ERROR = "deepcode.views.error";
export const DEEPCODE_VIEW_WELCOME = "deepcode.views.welcome";
export const DEEPCODE_VIEW_TC = "deepcode.views.tc";
export const DEEPCODE_VIEW_EMPTY = "deepcode.views.empty";
export const DEEPCODE_VIEW_ANALYSIS = "deepcode.views.analysis";
export const DEEPCODE_VIEW_SUPPORT = "deepcode.views.support";
export const DEEPCODE_VIEW_ACTIONS = "deepcode.views.actions";

// Having multiple boolean contexts instead of a single context 
// with multiple values helps us to avoid flickering UI.
export const DEEPCODE_CONTEXT = {
  LOGGEDIN: "loggedIn",
  APPROVED: "uploadApproved",
  ANALYZING: "workspaceFound",
  ERROR: "error",
  MODE: "mode",
  ADVANCED: "advanced",
};

export const DEEPCODE_ERROR_CODES = {
  TRANSIENT: "transient",
  BLOCKING: "blocking",
};

export const DEEPCODE_MODE_CODES = {
  AUTO: 'auto',
  MANUAL: 'manual',
  PAUSED: 'paused',
  THROTTLED: 'throttled',
};

export const DEEPCODE_ANALYSIS_STATUS = {
  COLLECTING: "Collecting files",
  HASHING: "Hashing files",
  UPLOADING: "Uploading files",
  ANALYZING: "Analyzing files",
};