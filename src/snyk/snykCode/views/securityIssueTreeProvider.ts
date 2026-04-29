import { IConfiguration } from '../../common/configuration/configuration';
import { SNYK_ANALYSIS_STATUS } from '../../common/constants/views';
import { CodeIssueData } from '../../common/languageServer/types';
import { IContextService } from '../../common/services/contextService';
import { IProductService } from '../../common/services/productService';
import { IViewManagerService } from '../../common/services/viewManagerService';
import { TreeNode } from '../../common/views/treeNode';
import { IVSCodeLanguages } from '../../common/vscode/languages';
import { IssueTreeProvider } from './issueTreeProvider';
import { IFolderConfigs } from '../../common/configuration/folderConfigs';
import { ILog } from '../../common/logger/interfaces';

export default class CodeSecurityIssueTreeProvider extends IssueTreeProvider {
  constructor(
    protected readonly logger: ILog,
    protected viewManagerService: IViewManagerService,
    protected contextService: IContextService,
    protected codeService: IProductService<CodeIssueData>,
    protected configuration: IConfiguration,
    protected languages: IVSCodeLanguages,
    protected readonly folderConfigs: IFolderConfigs,
  ) {
    super(logger, contextService, codeService, configuration, languages, true, folderConfigs);
  }

  getRootChildren(): TreeNode[] {
    if (!this.isCodeSecurityEnabledAnywhere()) {
      return [
        new TreeNode({
          text: SNYK_ANALYSIS_STATUS.CODE_SECURITY_DISABLED,
        }),
      ];
    }

    return super.getRootChildren();
  }

  // Snyk Code is enabled when at least one folder is effectively enabled. For each folder reported by
  // LS via $/snyk.configuration.folderConfigs[].settings, the folder's `snyk_code_enabled` value is
  // preferred; if the folder did not override it, we fall back to the global VS Code setting. With no
  // folder configs at all, only the global setting is consulted.
  private isCodeSecurityEnabledAnywhere(): boolean {
    const global = !!this.configuration.getFeaturesConfiguration()?.codeSecurityEnabled;
    const folderConfigs = this.configuration.getFolderConfigs();
    if (folderConfigs.length === 0) return global;
    return folderConfigs.some(fc => fc.snykCodeEnabled() ?? global);
  }

  onDidChangeTreeData = this.viewManagerService.refreshCodeSecurityViewEmitter.event;
}
