import { IConfiguration } from '../../common/configuration/configuration';
import { configuration } from '../../common/configuration/instance';
import { SNYK_ANALYSIS_STATUS } from '../../common/constants/views';
import { CodeIssueData } from '../../common/languageServer/types';
import { IContextService } from '../../common/services/contextService';
import { IProductService } from '../../common/services/productService';
import { IViewManagerService } from '../../common/services/viewManagerService';
import { TreeNode } from '../../common/views/treeNode';
import { IVSCodeLanguages } from '../../common/vscode/languages';
import { IssueTreeProvider } from './issueTreeProvider';
import { FEATURE_FLAGS } from '../../common/constants/featureFlags';

export default class CodeSecurityIssueTreeProvider extends IssueTreeProvider {
  constructor(
    protected viewManagerService: IViewManagerService,
    protected contextService: IContextService,
    protected codeService: IProductService<CodeIssueData>,
    protected configuration: IConfiguration,
    protected languages: IVSCodeLanguages,
  ) {
    super(contextService, codeService, configuration, languages, true);
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

  protected getIssueDescriptionText(dir: string | undefined, issueCount: number): string | undefined {
    return `${dir} - ${issueCount} ${issueCount === 1 ? 'vulnerability' : 'vulnerabilities'}`;
  }

  protected getIssueFoundText(nIssues: number, ignoredIssueCount: number): string {
    if (nIssues > 0) {
      let text;

      if (nIssues === 1) {
        text = `${nIssues} vulnerability found by Snyk`;
      } else {
        text = `✋ ${nIssues} vulnerabilities found by Snyk`;
      }

      const isIgnoresEnabled = configuration.getFeatureFlag(FEATURE_FLAGS.consistentIgnores);
      if (isIgnoresEnabled) {
        text += `, ${ignoredIssueCount} ignored`;
      }
      return text;
    } else {
      return '✅ Congrats! No vulnerabilities found!';
    }
  }
}
