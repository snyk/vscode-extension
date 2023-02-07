export const SNYK_VIEW_WELCOME = 'snyk.views.welcome';
export const SNYK_VIEW_FEATURES = 'snyk.views.features';
export const SNYK_VIEW_ANALYSIS_CODE_SECURITY = 'snyk.views.analysis.code.security';
export const SNYK_VIEW_ANALYSIS_CODE_QUALITY = 'snyk.views.analysis.code.quality';
export const SNYK_VIEW_ANALYSIS_OSS = 'snyk.views.analysis.oss';
export const SNYK_VIEW_SUPPORT = 'snyk.views.support';
export const SNYK_VIEW_SUGGESTION_CODE = 'snyk.views.suggestion.code';
export const SNYK_VIEW_SUGGESTION_CODE_OLD = 'snyk.views.suggestion.code.old';
export const SNYK_VIEW_FALSE_POSITIVE_CODE = 'snyk.views.suggestion.code.falsePositive';
export const SNYK_VIEW_SUGGESTION_OSS = 'snyk.views.suggestion.oss';

// Having multiple boolean contexts instead of a single context
// with multiple values helps us to avoid flickering UI.
export const SNYK_CONTEXT = {
  LOGGEDIN: 'loggedIn',
  AUTHENTICATING: 'authenticating',
  FEATURES_SELECTED: 'featuresSelected',
  CODE_LOCAL_ENGINE_ENABLED: 'codeLocalEngineEnabled',
  LS_CODE_PREVIEW: 'lsCodePreview',
  WORKSPACE_FOUND: 'workspaceFound',
  ERROR: 'error',
  MODE: 'mode',
  ADVANCED: 'advanced',
};

export const SNYK_ERROR_CODES = {
  BLOCKING: 'blocking',
};

export const SNYK_SCAN_STATUS = {
  OSS_DISABLED: 'Snyk Open Source Security is disabled. Enable it in settings to use it.',
  CODE_SECURITY_DISABLED: 'Snyk Code Security is disabled. Enable it in settings to use it.',
  CODE_QUALITY_DISABLED: 'Snyk Code Quality is disabled. Enable it in settings to use it.',
};
