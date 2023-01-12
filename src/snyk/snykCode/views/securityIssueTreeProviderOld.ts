import { Diagnostic } from 'vscode';
import { IConfiguration } from '../../common/configuration/configuration';
import { configuration } from '../../common/configuration/instance';
import { SNYK_ANALYSIS_STATUS } from '../../common/constants/views';
import { IContextService } from '../../common/services/contextService';
import { IViewManagerService } from '../../common/services/viewManagerService';
import { TreeNode } from '../../common/views/treeNode';
import { ISnykCodeServiceOld } from '../codeServiceOld';
import { IssueTreeProviderOld } from './issueTreeProviderOld';

export class CodeSecurityIssueTreeProviderOld extends IssueTreeProviderOld {
  constructor(
    protected viewManagerService: IViewManagerService,
    protected contextService: IContextService,
    protected snykCode: ISnykCodeServiceOld,
    protected configuration: IConfiguration,
  ) {
    super(contextService, snykCode, snykCode.analyzer.codeSecurityReview, configuration);
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

  onDidChangeTreeData = this.viewManagerService.refreshOldCodeSecurityViewEmitter.event;

  protected getIssueDescriptionText(dir: string | undefined, diagnostics: readonly Diagnostic[]): string | undefined {
    return `${dir} - ${diagnostics.length} ${diagnostics.length === 1 ? 'vulnerability' : 'vulnerabilities'}`;
  }

  protected getIssueFoundText(nIssues: number): string {
    return `Snyk found ${
      !nIssues ? 'no vulnerabilities! ✅' : `${nIssues} ${nIssues === 1 ? 'vulnerability' : 'vulnerabilities'}`
    }`;
  }
}
