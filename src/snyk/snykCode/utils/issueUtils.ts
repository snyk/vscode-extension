import _ from 'lodash';
import { CodeIssueData, IssueSeverity } from '../../common/languageServer/types';
import { IVSCodeLanguages } from '../../common/vscode/languages';
import { Range } from '../../common/vscode/types';

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
  static issueSeverityAsText = (severity: IssueSeverity): 'Low' | 'Medium' | 'High' | 'Critical' => {
    return _.startCase(severity) as 'Low' | 'Medium' | 'High' | 'Critical';
  };

  // todo: remove with OSS integration
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

  static createVsCodeRange = (issueData: CodeIssueData, languages: IVSCodeLanguages): Range => {
    return IssueUtils.createVsCodeRangeFromRange(issueData.rows, issueData.cols, languages);
  };

  static createVsCodeRangeFromRange(rows: number[], cols: number[], languages: IVSCodeLanguages): Range {
    const rowOffset = 1;
    const createPosition = (i: number): number => (i - rowOffset < 0 ? 0 : i - rowOffset);

    return languages.createRange(createPosition(rows[0]), createPosition(cols[0]), createPosition(rows[1]), cols[1]);
  }
}
