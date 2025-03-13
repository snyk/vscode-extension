import { CodeIssueData, Issue, IssueSeverity } from '../../../snyk/common/languageServer/types';

const mockCodeIssue: Issue<CodeIssueData> = {
  id: '123MockIssue456',
  title: 'Mock issue',
  severity: IssueSeverity.Low,
  filePath: '//folderName//test.js',
  additionalData: {
    message: 'Mock message',
    leadURL: undefined,
    rule: 'mock-rule',
    ruleId: '123MockRule456',
    repoDatasetSize: 0,
    exampleCommitFixes: [],
    cwe: [],
    text: 'Mock text',
    markers: undefined,
    cols: [0, 0],
    rows: [0, 0],
    isSecurityType: true,
    priorityScore: 99,
    hasAIFix: false,
    details: 'Mock details',
  },
  isIgnored: false,
};

export function makeMockCodeIssue(overridingProperties?: Partial<Issue<Partial<CodeIssueData>>>): Issue<CodeIssueData> {
  if (!overridingProperties) {
    return mockCodeIssue;
  }
  return {
    ...mockCodeIssue,
    ...overridingProperties,
    additionalData: {
      ...mockCodeIssue.additionalData,
      ...overridingProperties.additionalData,
    },
  };
}
