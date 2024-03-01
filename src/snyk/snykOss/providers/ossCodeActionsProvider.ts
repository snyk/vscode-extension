import { CodeAction, Range, TextDocument, Uri } from 'vscode';
import { OpenCommandIssueType, OpenIssueCommandArg } from '../../common/commands/types';
import { SNYK_OPEN_ISSUE_COMMAND } from '../../common/constants/commands';
import { CodeActionsProvider } from '../../common/editor/codeActionsProvider';
import { Issue, IssueSeverity, OssIssueData } from '../../common/languageServer/types';
import { ProductResult } from '../../common/services/productService';
import { ICodeActionAdapter, ICodeActionKindAdapter } from '../../common/vscode/codeAction';
import { IVSCodeLanguages } from '../../common/vscode/languages';
import { CodeActionContext } from '../../common/vscode/types';
import { DIAGNOSTICS_OSS_COLLECTION_NAME_LS } from '../../snykCode/constants/analysis';
import { getOssIssueCommandArg } from './ossIssueCommandHelper';

export class OssCodeActionsProvider extends CodeActionsProvider<OssIssueData> {
  constructor(
    private readonly languages: IVSCodeLanguages,
    private readonly codeActionAdapter: ICodeActionAdapter,
    codeActionKindAdapter: ICodeActionKindAdapter,
    issues: Readonly<ProductResult<OssIssueData>>,
  ) {
    super(issues, codeActionKindAdapter);
  }

  override provideCodeActions(
    document: TextDocument,
    _clickedRange: Range,
    context: CodeActionContext,
  ): CodeAction[] | undefined {
    // is there a better way to get the folder path?
    const folderPath = document.uri.fsPath.split('/').slice(0, -1).join('/');
    if (!folderPath) {
      return;
    }

    const vulnerabilities = this.getVulnerabilities(folderPath, context);
    if (!vulnerabilities) {
      return;
    }

    const mostSevereVulnerability = this.getMostSevereVulnerability(vulnerabilities, folderPath);
    if (!mostSevereVulnerability) {
      return;
    }

    return this.getActions(folderPath, document, mostSevereVulnerability, this.getIssueRange(mostSevereVulnerability));
  }

  getActions(
    _folderPath: string,
    _document: TextDocument,
    mostSevereVulnerability: Issue<OssIssueData>,
    _issueRange?: Range,
  ): CodeAction[] {
    const openIssueAction = this.createMostSevereVulnerabilityAction(mostSevereVulnerability);

    // returns list of actions, all new actions should be added to this list
    return [openIssueAction];
  }

  // noop
  getIssueRange(_issue: Issue<OssIssueData>): Range {
    return this.languages.createRange(0, 0, 0, 0);
  }

  private createMostSevereVulnerabilityAction(mostSevereVulnerability: Issue<OssIssueData>): CodeAction {
    // create the CodeAction
    const openIssueAction = this.codeActionAdapter.create(
      `Show the most severe vulnerability [${mostSevereVulnerability.id}] (Snyk)`,
      this.providedCodeActionKinds[0],
    );

    openIssueAction.command = {
      command: SNYK_OPEN_ISSUE_COMMAND,
      title: SNYK_OPEN_ISSUE_COMMAND,
      arguments: [
        {
          issueType: OpenCommandIssueType.OssVulnerability,
          issue: mostSevereVulnerability,
        } as OpenIssueCommandArg,
      ],
    };

    return openIssueAction;
  }

  private issueSeverityToRanking(severity: IssueSeverity): number {
    switch (severity) {
      case IssueSeverity.Critical:
        return 3;
      case IssueSeverity.High:
        return 2;
      case IssueSeverity.Medium:
        return 1;
      default:
        return 0;
    }
  }

  private getVulnerabilities(folderPath: string, context: CodeActionContext): Issue<OssIssueData>[] | undefined {
    // get all OSS vulnerabilities for the folder
    const ossResult = this.issues.get(folderPath);
    if (!ossResult || ossResult instanceof Error) {
      return;
    }

    // get all OSS diagnostics; these contain the relevant vulnerabilities
    const ossDiagnostics = context.diagnostics.filter(d => d.source === DIAGNOSTICS_OSS_COLLECTION_NAME_LS);
    if (!ossDiagnostics.length) {
      return;
    }

    // find the corresponding Issue<OssIssueData> objects from ossDiagnostics
    const vulnerabilities: Issue<OssIssueData>[] = [];
    for (const diagnostic of ossDiagnostics) {
      const vulnerability = ossResult.find(
        ossIssue => ossIssue.id === (diagnostic.code as { value: string | number; target: Uri }).value,
      );
      if (!vulnerability) {
        continue;
      }
      vulnerabilities.push(vulnerability);
    }

    return vulnerabilities;
  }

  private getMostSevereVulnerability(
    vulnerabilities: Issue<OssIssueData>[],
    folderPath: string,
  ): Issue<OssIssueData> | undefined {
    // iterate vulnerabilities and get the most severe one
    // if there are multiple of the same severity, get the first one
    let highestSeverity = this.issueSeverityToRanking(IssueSeverity.Low);
    let mostSevereVulnerability: Issue<OssIssueData> | undefined;

    for (const vulnerability of vulnerabilities) {
      if (this.issueSeverityToRanking(vulnerability.severity) > highestSeverity) {
        highestSeverity = this.issueSeverityToRanking(vulnerability.severity);
        mostSevereVulnerability = vulnerability;
      }
    }

    if (!mostSevereVulnerability) {
      return;
    }

    return getOssIssueCommandArg(mostSevereVulnerability, folderPath, vulnerabilities);
  }
}
