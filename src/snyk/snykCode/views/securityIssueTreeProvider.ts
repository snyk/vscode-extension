import { configuration } from '../../common/configuration/instance';
import { SNYK_ANALYSIS_STATUS } from '../../common/constants/views';
import { ISnykCodeService } from '../codeService';
import { IContextService } from '../../common/services/contextService';
import { IViewManagerService } from '../../common/services/viewManagerService';
import { IssueTreeProvider } from './issueTreeProvider';
import { TreeNode } from '../../common/views/treeNode';
import { Diagnostic } from 'vscode';

export class CodeSecurityIssueTreeProvider extends IssueTreeProvider {
  constructor(
    protected viewManagerService: IViewManagerService,
    protected contextService: IContextService,
    protected snykCode: ISnykCodeService,
  ) {
    super(contextService, snykCode, snykCode.analyzer.codeSecurityReview);
  }

  getRootChildren(): TreeNode[] {
    if (!configuration.getFeaturesConfiguration()?.codeSecurityEnabled) {
      return [
        new TreeNode({
          text: SNYK_ANALYSIS_STATUS.CODE_SECURITY_DISABLED,
        }),
      ];
    }

    return super.getRootChildren();
  }

  onDidChangeTreeData = this.viewManagerService.refreshCodeSecurityViewEmitter.event;

  protected getIssueDescriptionText(dir: string | undefined, diagnostics: readonly Diagnostic[]): string | undefined {
    return `${dir} - ${diagnostics.length} ${diagnostics.length === 1 ? 'vulnerability' : 'vulnerabilities'}`;
  }

  protected getIssueFoundText(nIssues: number): string {
    return `Snyk found ${
      !nIssues ? 'no vulnerabilities! ✅' : `${nIssues} ${nIssues === 1 ? 'vulnerability' : 'vulnerabilities'}`
    }`;
  }
}
