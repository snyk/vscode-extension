import { IacIssueData, Issue } from '../common/languageServer/types';
import { IVSCodeLanguages } from '../common/vscode/languages';
import { Range } from '../common/vscode/types';

export class IacIssue {
  static getRange(issue: Issue<IacIssueData>, languages: IVSCodeLanguages): Range {
    return languages.createRange(issue.additionalData.lineNumber, 0, issue.additionalData.lineNumber, Number.MAX_VALUE);
  }
}
