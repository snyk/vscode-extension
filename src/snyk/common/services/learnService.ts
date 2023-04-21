import vscode from 'vscode';
import { completeFileSuggestionType } from '../../snykCode/interfaces';
import { OssIssueCommandArg } from '../../snykOss/views/ossVulnerabilityTreeProvider';
import { CodeIssueData, Issue } from '../languageServer/types';

export type Lesson = {
  url: string;
  title: string;
};

export async function getOssLesson(vulnerability: OssIssueCommandArg): Promise<Lesson | undefined> {
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
  const lesson: Lesson = await vscode.commands.executeCommand(
    'snyk.getLearnLesson',
    vulnerability.id,
    vulnerability.packageManager,
    cweElement,
    cveElement,
    '4',
  );
  return lesson ?? undefined;
}

export async function getCodeLesson(issue: Issue<CodeIssueData>): Promise<Lesson | undefined> {
  const ruleSplit = issue.additionalData.ruleId.split('/');
  const rule = ruleSplit[ruleSplit.length - 1];
  const ecosystem = ruleSplit[0];
  const additionalData = issue.additionalData;
  let cwe = '';
  if (additionalData.cwe.length > 0) {
    cwe = additionalData.cwe[0];
  }

  const lesson: Lesson = await vscode.commands.executeCommand('snyk.getLearnLesson', rule, ecosystem, cwe, '', '2');
  return lesson ?? undefined;
}

export async function getCodeLessonOld(issue: completeFileSuggestionType): Promise<Lesson | undefined> {
  const ruleSplit = issue.id.split('/');
  const rule = ruleSplit[ruleSplit.length - 1];
  const ecosystem = ruleSplit[0];

  let cwe = '';
  if (issue.cwe.length > 0) {
    cwe = issue.cwe[0];
  }

  const lesson: Lesson = await vscode.commands.executeCommand('snyk.getLearnLesson', rule, ecosystem, cwe, '', '2');
  return lesson ?? undefined;
}
