// Original file: src/api/proto/autofix.proto

import type { RuleReports as _autofix_RuleReports, RuleReports__Output as _autofix_RuleReports__Output } from '../autofix/RuleReports';

export interface CommitRuleReport {
  'precommitReports'?: (_autofix_RuleReports | null);
  'postcommitReports'?: (_autofix_RuleReports | null);
  'fixedRuleIndices'?: (number)[];
}

export interface CommitRuleReport__Output {
  'precommitReports': (_autofix_RuleReports__Output | null);
  'postcommitReports': (_autofix_RuleReports__Output | null);
  'fixedRuleIndices': (number)[];
}
