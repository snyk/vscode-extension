import { OssIssueCommandArg } from '../../snykOssOld/views/ossVulnerabilityTreeProvider';
import { SNYK_GET_LESSON_COMMAND } from '../constants/commands';
import { CodeIssueData, Issue } from '../languageServer/types';
import { IVSCodeCommands } from '../vscode/commands';

export type Lesson = {
  url: string;
  title: string;
};

export class LearnService {
  constructor(private commandExecutor: IVSCodeCommands) {}

  async getOssLesson(vulnerability: OssIssueCommandArg): Promise<Lesson | undefined> {
    const cwe = vulnerability.identifiers?.CWE;
    let cweElement = '';
    if (cwe && cwe.length > 0) {
      cweElement = cwe[0];
    }

    const cve = vulnerability.identifiers?.CWE;
    let cveElement = '';
    if (cve && cve.length > 0) {
      cveElement = cve[0];
    }
    return this.commandExecutor.executeCommand(
      SNYK_GET_LESSON_COMMAND,
      vulnerability.id,
      vulnerability.packageManager,
      cweElement,
      cveElement,
      4,
    );
  }

  async getCodeLesson(issue: Issue<CodeIssueData>): Promise<Lesson | undefined> {
    const ruleSplit = issue.additionalData.ruleId.split('/');
    const rule = ruleSplit[ruleSplit.length - 1];
    const ecosystem = ruleSplit[0];
    const additionalData = issue.additionalData;
    let cwe = '';
    if (additionalData.cwe.length > 0) {
      cwe = additionalData.cwe[0];
    }

    return this.commandExecutor.executeCommand(SNYK_GET_LESSON_COMMAND, rule, ecosystem, cwe, '', 2);
  }
}
