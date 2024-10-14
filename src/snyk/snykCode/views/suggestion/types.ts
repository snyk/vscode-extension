import { AutofixUnifiedDiffSuggestion, ExampleCommitFix, Marker, Point } from '../../../common/languageServer/types';
import { Lesson } from '../../../common/services/learnService';

export type Suggestion = {
  id: string;
  message: string;
  severity: string;
  leadURL?: string;
  rule: string;
  repoDatasetSize: number;
  exampleCommitFixes: ExampleCommitFix[];
  cwe: string[];
  title: string;
  text: string;
  isSecurityType: boolean;
  markers?: Marker[];
  cols: Point;
  rows: Point;
  hasAIFix?: boolean;
  filePath: string;
  showInlineIgnoresButton: boolean;
};

export type OpenLocalMessage = {
  type: 'openLocal';
  args: {
    uri: string;
    cols: [number, number];
    rows: [number, number];
    suggestionUri: string;
  };
};

export type IgnoreIssueMessage = {
  type: 'ignoreIssue';
  args: {
    id: string;
    severity: 'Low' | 'Medium' | 'High';
    lineOnly: boolean;
    message: string;
    rule: string;
    uri: string;
    cols: [number, number];
    rows: [number, number];
  };
};

export type OpenBrowserMessage = {
  type: 'openBrowser';
  args: {
    url: string;
  };
};

export type GetAutofixDiffsMesssage = {
  type: 'getAutofixDiffs';
  args: {
    suggestion: Suggestion;
  };
};

export type ApplyGitDiffMessage = {
  type: 'applyGitDiff';
  args: {
    patch: string;
    filePath: string;
    fixId: string;
  };
};

export type SetSuggestionMessage = {
  type: 'set';
  args: Suggestion;
};

export type GetSuggestionMessage = {
  type: 'get';
};

export type SetLessonMessage = {
  type: 'setLesson';
  args: Lesson | null;
};

export type GetLessonMessage = {
  type: 'getLesson';
};

export type SetAutofixDiffsMessage = {
  type: 'setAutofixDiffs';
  args: {
    suggestion: Suggestion;
    diffs: AutofixUnifiedDiffSuggestion[];
  };
};

export type SetAutofixErrorMessage = {
  type: 'setAutofixError';
  args: {
    suggestion: Suggestion;
  };
};

export type SuggestionMessage =
  | OpenLocalMessage
  | OpenBrowserMessage
  | IgnoreIssueMessage
  | GetAutofixDiffsMesssage
  | ApplyGitDiffMessage
  | SetSuggestionMessage
  | GetSuggestionMessage
  | SetLessonMessage
  | GetLessonMessage
  | SetAutofixDiffsMessage
  | SetAutofixErrorMessage;
