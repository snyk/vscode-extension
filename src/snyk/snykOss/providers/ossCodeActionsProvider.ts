import marked from 'marked';
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
import { OssIssueCommandArg } from '../interfaces';

export class OssCodeActionsProvider extends CodeActionsProvider<OssIssueData> {
  constructor(
    issues: Readonly<ProductResult<OssIssueData>>,
    private readonly codeActionAdapter: ICodeActionAdapter,
    codeActionKindAdapter: ICodeActionKindAdapter,
    private readonly languages: IVSCodeLanguages,
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

    // get all OSS vulnerabilities for the folder
    const ossResult = this.issues.get(folderPath);
    if (!ossResult || ossResult instanceof Error) {
      return;
    }

    // get all OSS diagnostics; these contain the relavnt vulnerabilities
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
          issue: this.getOssIssueCommandArg(mostSevereVulnerability, vulnerabilities),
        } as OpenIssueCommandArg,
      ],
    };

    const analyticsType = this.getAnalyticsActionTypes();

    this.analytics.logQuickFixIsDisplayed({
      quickFixType: analyticsType,
      ide: IDE_NAME,
    });

    return [openIssueAction];
  }

  getActions(folderPath: string, _: TextDocument, issue: Issue<OssIssueData>, range: Range): CodeAction[] {
    const openIssueAction = this.createOpenIssueAction(folderPath, issue, range);

    // returns list of actions, all new actions should be added to this list
    return [openIssueAction];
  }

  getAnalyticsActionTypes(): [string, ...string[]] & [SupportedQuickFixProperties, ...SupportedQuickFixProperties[]] {
    return ['Show Suggestion'];
  }

  getIssueRange(_issue: Issue<OssIssueData>): Range {
    return this.languages.createRange(0, 0, 0, 0);
  }

  getOssIssueCommandArg(issue: Issue<OssIssueData>, filteredIssues: Issue<OssIssueData>[]): OssIssueCommandArg {
    const matchingIdVulnerabilities = filteredIssues.filter(v => v.id === issue.id);
    let overviewHtml = '';

    try {
      // TODO: marked.parse does not sanitize the HTML. See: https://marked.js.org/#usage
      overviewHtml = marked.parse(issue.additionalData.description);
    } catch (error) {
      overviewHtml = '<p>There was a problem rendering the vulnerability overview</p>';
    }

    return {
      ...issue,
      matchingIdVulnerabilities,
      overviewHtml,
    };
  }

  private createOpenIssueAction(_folderPath: string, issue: Issue<OssIssueData>, _issueRange: Range): CodeAction {
    const openIssueAction = this.codeActionAdapter.create(
      'Show the most severe vulnerability (Snyk)',
      this.providedCodeActionKinds[0],
    );

    openIssueAction.command = {
      command: SNYK_OPEN_ISSUE_COMMAND,
      title: SNYK_OPEN_ISSUE_COMMAND,
      arguments: [
        {
          issueType: OpenCommandIssueType.OssVulnerability,
          issue: {
            ...issue,
            matchingIdVulnerabilities: [issue],
            overviewHtml: '',
          },
        },
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
}
