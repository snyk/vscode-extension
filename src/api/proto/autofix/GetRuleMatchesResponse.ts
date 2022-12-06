// Original file: src/api/proto/autofix_main_api.proto

import type { AutofixApiStatus as _autofix_AutofixApiStatus, AutofixApiStatus__Output as _autofix_AutofixApiStatus__Output } from '../autofix/AutofixApiStatus';
import type { RuleReport as _autofix_RuleReport, RuleReport__Output as _autofix_RuleReport__Output } from '../autofix/RuleReport';

export interface GetRuleMatchesResponse {
  'status'?: (_autofix_AutofixApiStatus | null);
  'ruleMatches'?: (_autofix_RuleReport)[];
}

export interface GetRuleMatchesResponse__Output {
  'status': (_autofix_AutofixApiStatus__Output | null);
  'ruleMatches': (_autofix_RuleReport__Output)[];
}
