import { FileSuggestion } from '@snyk/code-client';
import { Diagnostic, Position, Range } from '../../common/vscode/types';

export type IssuePlacementPosition = {
  cols: {
    start: number;
    end: number;
  };
  rows: {
    start: number;
    end: number;
  };
};

export class IssueUtils {
  static findIssueWithRange = (
    matchingRange: Range | Position,
    issuesList: readonly Diagnostic[] | undefined,
  ): Diagnostic | undefined => {
    return (
      issuesList &&
      issuesList.find((issue: Diagnostic) => {
        return issue.range.contains(matchingRange);
      })
    );
  };

  static severityAsText = (severity: 1 | 2 | 3 | 4): 'Low' | 'Medium' | 'High' | 'Critical' => {
    switch (severity) {
      case 1:
        return 'Low';
      case 2:
        return 'Medium';
      case 3:
        return 'High';
      case 4:
        return 'Critical';
    }
  };

  static getIssueType = (isSecurityType: boolean): 'Code Security Vulnerability' | 'Code Quality Issue' => {
    return isSecurityType ? 'Code Security Vulnerability' : 'Code Quality Issue';
  };

  static createCorrectIssuePlacement = (item: FileSuggestion): IssuePlacementPosition => {
    const rowOffset = 1;
    const createPosition = (i: number): number => (i - rowOffset < 0 ? 0 : i - rowOffset);
    return {
      cols: {
        start: createPosition(item.cols[0]),
        end: item.cols[1],
      },
      rows: {
        start: createPosition(item.rows[0]),
        end: createPosition(item.rows[1]),
      },
    };
  };
}
