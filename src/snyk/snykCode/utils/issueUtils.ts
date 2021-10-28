import { Diagnostic, Position, Range } from '../../common/vscode/types';

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
}
