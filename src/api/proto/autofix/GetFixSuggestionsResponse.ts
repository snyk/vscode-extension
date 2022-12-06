// Original file: src/api/proto/autofix_main_api.proto

import type { AutofixApiStatus as _autofix_AutofixApiStatus, AutofixApiStatus__Output as _autofix_AutofixApiStatus__Output } from '../autofix/AutofixApiStatus';

export interface GetFixSuggestionsResponse {
  'status'?: (_autofix_AutofixApiStatus | null);
  'fixes'?: (string)[];
}

export interface GetFixSuggestionsResponse__Output {
  'status': (_autofix_AutofixApiStatus__Output | null);
  'fixes': (string)[];
}
