// Original file: src/api/proto/autofix.proto

import type { RuleReport as _autofix_RuleReport, RuleReport__Output as _autofix_RuleReport__Output } from '../autofix/RuleReport';

export interface RuleReports {
  'reports'?: (_autofix_RuleReport)[];
  'fileName'?: (string);
  'repo'?: (string);
  'changeId'?: (string);
}

export interface RuleReports__Output {
  'reports': (_autofix_RuleReport__Output)[];
  'fileName': (string);
  'repo': (string);
  'changeId': (string);
}
