export const SNYK_VIEW_ANALYSIS = 'snyk.views.analysis';
export const SNYK_VIEW_SUPPORT = 'snyk.views.support';
export const SNYK_VIEW_ACTIONS = 'snyk.views.actions';
export const SNYK_VIEW_SUGGESTION = 'snyk.views.suggestion';

// Having multiple boolean contexts instead of a single context
// with multiple values helps us to avoid flickering UI.
export const SNYK_CONTEXT = {
  LOGGEDIN: 'loggedIn',
  AUTHENTICATING: 'authenticating',
  CODE_ENABLED: 'codeEnabled',
  WORKSPACE_FOUND: 'workspaceFound',
  ERROR: 'error',
  MODE: 'mode',
  ADVANCED: 'advanced',
};

export const SNYK_ERROR_CODES = {
  TRANSIENT: 'transient',
  BLOCKING: 'blocking',
};

export const SNYK_MODE_CODES = {
  AUTO: 'auto',
  MANUAL: 'manual',
  PAUSED: 'paused',
  THROTTLED: 'throttled',
};

export const SNYK_ANALYSIS_STATUS = {
  FILTERS: 'Supported extentions',
  COLLECTING: 'Collecting files',
  BUNDLING: 'Creating file bundles',
  UPLOADING: 'Uploading files',
};
