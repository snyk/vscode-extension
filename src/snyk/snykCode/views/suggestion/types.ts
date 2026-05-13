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
};

type OpenLocalMessage = {
  type: 'openLocal';
  args: {
    uri: string;
    cols: [number, number];
    rows: [number, number];
    suggestionUri: string;
  };
};

type IgnoreIssueMessage = {
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

type OpenBrowserMessage = {
  type: 'openBrowser';
  args: {
    url: string;
  };
};

type GetAutofixDiffsMesssage = {
  type: 'getAutofixDiffs';
  args: {
    suggestion: Suggestion;
  };
};

type FixApplyEditMessage = {
  type: 'fixApplyEdit';
  args: {
    fixId: string;
  };
};

type SetSuggestionMessage = {
  type: 'set';
  args: Suggestion;
};

type GetSuggestionMessage = {
  type: 'get';
};

type SetLessonMessage = {
  type: 'setLesson';
  args: Lesson | null;
};

type GetLessonMessage = {
  type: 'getLesson';
};

type SetAutofixDiffsMessage = {
  type: 'setAutofixDiffs';
  args: {
    suggestion: Suggestion;
    diffs: AutofixUnifiedDiffSuggestion[];
  };
};

type SetAutofixErrorMessage = {
  type: 'setAutofixError';
  args: {
    suggestion: Suggestion;
  };
};

export type SuggestionMessage =
  | OpenLocalMessage
  | OpenBrowserMessage
  | IgnoreIssueMessage
  | SubmitIgnoreRequestMessage
  | GetAutofixDiffsMesssage
  | FixApplyEditMessage
  | SetSuggestionMessage
  | GetSuggestionMessage
  | SetLessonMessage
  | GetLessonMessage
  | SetAutofixDiffsMessage
  | SetAutofixErrorMessage;
