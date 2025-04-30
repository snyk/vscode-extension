import { CodeIssueData, IacIssueData, Issue, IssueSeverity } from '../../../snyk/common/languageServer/types';

const mockCodeIssue: Issue<CodeIssueData> = {
  id: '123MockCodeIssue456',
  title: 'Mock Code issue',
  severity: IssueSeverity.Low,
  filePath: '//folderName//test.js',
  range: {
    start: {
      line: 0,
      character: 0,
    },
    end: {
      line: 0,
      character: 0,
    },
  },
  isIgnored: false,
  isNew: false,
  filterableIssueType: '',
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
};

const mockIaCIssue: Issue<IacIssueData> = {
  id: '123MockIaCIssue456',
  title: 'Mock IaC issue',
  severity: IssueSeverity.Low,
  filePath: '//folderName//test.js',
  range: {
    start: {
      line: 0,
      character: 0,
    },
    end: {
      line: 0,
      character: 0,
    },
  },
  isIgnored: false,
  isNew: false,
  filterableIssueType: '',
  additionalData: {
    publicId: '',
    documentation: '',
    lineNumber: 0,
    issue: '',
    impact: '',
    path: undefined,
    resolve: undefined,
    references: undefined,
    customUIContent: ''
  }
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

export function makeMockIaCIssue(overridingProperties?: Partial<Issue<Partial<IacIssueData>>>): Issue<IacIssueData> {
  if (!overridingProperties) {
    return mockIaCIssue;
  }
  return {
    ...mockIaCIssue,
    ...overridingProperties,
    additionalData: {
      ...mockIaCIssue.additionalData,
      ...overridingProperties.additionalData,
    },
  };
}
