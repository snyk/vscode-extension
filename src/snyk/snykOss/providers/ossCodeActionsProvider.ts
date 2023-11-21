import { CodeAction, Range, TextDocument, Uri } from 'vscode';
import { IAnalytics, SupportedQuickFixProperties } from '../../common/analytics/itly';
import { OpenCommandIssueType, OpenIssueCommandArg } from '../../common/commands/types';
import { SNYK_OPEN_ISSUE_COMMAND } from '../../common/constants/commands';
import { IDE_NAME } from '../../common/constants/general';
import { CodeActionsProvider } from '../../common/editor/codeActionsProvider';
import { Issue, IssueSeverity, OssIssueData } from '../../common/languageServer/types';
import { ProductResult } from '../../common/services/productService';
import { ICodeActionAdapter, ICodeActionKindAdapter } from '../../common/vscode/codeAction';
import { IVSCodeLanguages } from '../../common/vscode/languages';
import { CodeActionContext } from '../../common/vscode/types';
import { DIAGNOSTICS_OSS_COLLECTION_NAME_LS } from '../../snykCode/constants/analysis';

export class OssCodeActionsProvider extends CodeActionsProvider<OssIssueData> {
  constructor(
    private readonly languages: IVSCodeLanguages,
    private readonly codeActionAdapter: ICodeActionAdapter,
    codeActionKindAdapter: ICodeActionKindAdapter,
    issues: Readonly<ProductResult<OssIssueData>>,
    analytics: IAnalytics,
  ) {
    super(issues, codeActionKindAdapter, analytics);
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

    const mostSevereVulnerability = this.getMostSevereVulnerability(vulnerabilities);
    if (!mostSevereVulnerability) {
      return;
    }

    const codeActions = this.getActions(
      folderPath,
      document,
      mostSevereVulnerability,
      this.getIssueRange(mostSevereVulnerability),
    );
    const analyticsType = this.getAnalyticsActionTypes();

    this.analytics.logQuickFixIsDisplayed({
      quickFixType: analyticsType,
      ide: IDE_NAME,
    });

    return codeActions;
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

  getAnalyticsActionTypes(): [string, ...string[]] & [SupportedQuickFixProperties, ...SupportedQuickFixProperties[]] {
    return ['Show Suggestion'];
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

  private getMostSevereVulnerability(vulnerabilities: Issue<OssIssueData>[]): Issue<OssIssueData> | undefined {
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

    return mostSevereVulnerability;
  }
}
