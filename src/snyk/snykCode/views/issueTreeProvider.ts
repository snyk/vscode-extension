import { Command, Diagnostic, DiagnosticCollection, DiagnosticSeverity, Range, Uri } from 'vscode';
import { OpenCommandIssueType, OpenIssueCommandArg } from '../../common/commands/types';
import { IConfiguration } from '../../common/configuration/configuration';
import { SNYK_OPEN_ISSUE_COMMAND } from '../../common/constants/commands';
import { IContextService } from '../../common/services/contextService';
import { AnalysisTreeNodeProvder } from '../../common/views/analysisTreeNodeProvider';
import { INodeIcon, NODE_ICONS, TreeNode } from '../../common/views/treeNode';
import { ISnykCodeService } from '../codeService';
import { SNYK_SEVERITIES } from '../constants/analysis';
import { getSnykSeverity } from '../utils/analysisUtils';
import { CodeIssueCommandArg } from './interfaces';

interface ISeverityCounts {
  [severity: number]: number;
}

export class IssueTreeProvider extends AnalysisTreeNodeProvder {
  constructor(
    protected contextService: IContextService,
    protected snykCode: ISnykCodeService,
    protected diagnosticCollection: DiagnosticCollection | undefined,
    protected configuration: IConfiguration,
  ) {
    super(configuration, snykCode);
  }

  static getSeverityIcon(severity: number): INodeIcon {
    return (
      {
        [SNYK_SEVERITIES.error]: NODE_ICONS.high,
        [SNYK_SEVERITIES.warning]: NODE_ICONS.medium,
        [SNYK_SEVERITIES.information]: NODE_ICONS.low,
      }[severity] || NODE_ICONS.low
    );
  }

  static getFileSeverity(counts: ISeverityCounts): number {
    for (const s of [SNYK_SEVERITIES.error, SNYK_SEVERITIES.warning, SNYK_SEVERITIES.information]) {
      if (counts[s]) return s;
    }
    return SNYK_SEVERITIES.information;
  }

  getRootChildren(): TreeNode[] {
    const review: TreeNode[] = [];
    let nIssues = 0;
    if (!this.contextService.shouldShowCodeAnalysis) return review;
    if (this.diagnosticCollection)
      this.diagnosticCollection.forEach((uri: Uri, diagnostics: readonly Diagnostic[]): void => {
        const counts: ISeverityCounts = {
          [SNYK_SEVERITIES.information]: 0,
          [SNYK_SEVERITIES.warning]: 0,
          [SNYK_SEVERITIES.error]: 0,
        };
        const filePath = uri.path.split('/');
        const filename = filePath.pop() || uri.path;
        const dir = filePath.pop();

        nIssues += diagnostics.length;

        const fileVulnerabilities = this.getFilteredIssues(diagnostics);
        if (fileVulnerabilities.length == 0) return;

        const issues: TreeNode[] = fileVulnerabilities.map(d => {
          const severity = getSnykSeverity(d.severity);
          counts[severity] += 1;
          const params: {
            text: string;
            icon: INodeIcon;
            issue: { uri: Uri; range?: Range };
            internal: { severity: number };
            command: Command;
            children?: TreeNode[];
          } = {
            text: d.message,
            icon: IssueTreeProvider.getSeverityIcon(severity),
            issue: {
              uri,
              range: d.range,
            },
            internal: {
              severity,
            },
            command: {
              command: SNYK_OPEN_ISSUE_COMMAND,
              title: '',
              arguments: [
                {
                  issueType: OpenCommandIssueType.CodeIssue,
                  issue: {
                    message: d.message,
                    uri: uri,
                    range: d.range,
                  } as CodeIssueCommandArg,
                } as OpenIssueCommandArg,
              ],
            },
          };

          // // No need for markers in the node tree while having the suggestion view
          // if (d.relatedInformation && d.relatedInformation.length) {
          //   params.children = d.relatedInformation.map((h) =>
          //     new Node({
          //       text: h.message,
          //       issue: {
          //         uri: h.location.uri,
          //         range: h.location.range,
          //       },
          //       command: {
          //         command: SNYK_OPEN_ISSUE_COMMAND,
          //         title: '',
          //         arguments: [d.message, severity, uri, d.range, h.location.uri, h.location.range],
          //       }
          //     })
          //   );
          // }

          return new TreeNode(params);
        });
        issues.sort(this.compareNodes);
        const fileSeverity = IssueTreeProvider.getFileSeverity(counts);
        const file = new TreeNode({
          text: filename,
          description: this.getIssueDescriptionText(dir, diagnostics),
          icon: IssueTreeProvider.getSeverityIcon(fileSeverity),
          children: issues,
          internal: {
            nIssues: diagnostics.length,
            severity: fileSeverity,
          },
        });
        review.push(file);
      });
    review.sort(this.compareNodes);
    if (this.snykCode.isAnalysisRunning) {
      review.unshift(
        new TreeNode({
          text: this.snykCode.analysisStatus,
          description: this.snykCode.analysisProgress,
        }),
      );
    } else {
      const topNodes = [
        new TreeNode({
          text: this.getIssueFoundText(nIssues),
        }),
        this.getDurationTreeNode(),
        this.getNoSeverityFiltersSelectedTreeNode(),
      ];
      review.unshift(...topNodes.filter((n): n is TreeNode => n !== null));
    }
    return review;
  }

  protected getIssueFoundText(nIssues: number): string {
    return `Snyk found ${!nIssues ? 'no issues! ✅' : `${nIssues} issue${nIssues === 1 ? '' : 's'}`}`;
  }

  protected getIssueDescriptionText(dir: string | undefined, diagnostics: readonly Diagnostic[]): string | undefined {
    return `${dir} - ${diagnostics.length} issue${diagnostics.length === 1 ? '' : 's'}`;
  }

  protected getFilteredIssues(diagnostics: readonly Diagnostic[]): Diagnostic[] {
    return diagnostics.filter(issue => {
      switch (issue.severity) {
        case DiagnosticSeverity.Error:
          return this.configuration.severityFilter.high;
        case DiagnosticSeverity.Warning:
          return this.configuration.severityFilter.medium;
        case DiagnosticSeverity.Information:
        case DiagnosticSeverity.Hint:
          return this.configuration.severityFilter.low;
        default:
          return true;
      }
    });
  }
}
