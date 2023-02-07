import { IConfiguration } from '../../common/configuration/configuration';
import { configuration } from '../../common/configuration/instance';
import { SNYK_SCAN_STATUS } from '../../common/constants/views';
import { IContextService } from '../../common/services/contextService';
import { IViewManagerService } from '../../common/services/viewManagerService';
import { TreeNode } from '../../common/views/treeNode';
import { IVSCodeLanguages } from '../../common/vscode/languages';
import { ISnykCodeService } from '../codeService';
import { IssueTreeProvider } from './issueTreeProvider';

export default class CodeSecurityIssueTreeProvider extends IssueTreeProvider {
  constructor(
    protected viewManagerService: IViewManagerService,
    protected contextService: IContextService,
    protected codeService: ISnykCodeService,
    protected configuration: IConfiguration,
    protected languages: IVSCodeLanguages,
  ) {
    super(contextService, codeService, configuration, languages, true);
  }

  getRootChildren(): TreeNode[] {
    if (!configuration.getFeaturesConfiguration()?.codeSecurityEnabled) {
      return [
        new TreeNode({
          text: SNYK_SCAN_STATUS.CODE_SECURITY_DISABLED,
        }),
      ];
    }

    return super.getRootChildren();
  }

  onDidChangeTreeData = this.viewManagerService.refreshCodeSecurityViewEmitter.event;

  protected getIssueDescriptionText(dir: string | undefined, issueCount: number): string | undefined {
    return `${dir} - ${issueCount} ${issueCount === 1 ? 'vulnerability' : 'vulnerabilities'}`;
  }

  protected getIssueFoundText(nIssues: number): string {
    return `Snyk found ${
      !nIssues ? 'no vulnerabilities! ✅' : `${nIssues} ${nIssues === 1 ? 'vulnerability' : 'vulnerabilities'}`
    }`;
  }
}
