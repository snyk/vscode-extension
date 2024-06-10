import _ from 'lodash';
import { CodeIssueData } from '../../common/languageServer/types';
import { IVSCodeLanguages } from '../../common/vscode/languages';
import { Range } from '../../common/vscode/types';

export class IssueUtils {
  // Creates zero-based range
  static createVsCodeRange = (issueData: CodeIssueData, languages: IVSCodeLanguages): Range => {
    return IssueUtils.createVsCodeRangeFromRange(issueData.rows, issueData.cols, languages);
  };

  static createVsCodeRangeFromRange(rows: number[], cols: number[], languages: IVSCodeLanguages): Range {
    return languages.createRange(rows[0], cols[0], rows[1], cols[1]);
  }
}
