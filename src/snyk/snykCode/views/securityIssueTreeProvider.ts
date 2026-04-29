import { IConfiguration } from '../../common/configuration/configuration';
import { SNYK_ANALYSIS_STATUS } from '../../common/constants/views';
import { CodeIssueData } from '../../common/languageServer/types';
import { IContextService } from '../../common/services/contextService';
import { IProductService } from '../../common/services/productService';
import { IViewManagerService } from '../../common/services/viewManagerService';
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

  protected isProductEnabledForFolder(folderPath: string): boolean {
    return !!this.configuration.getFeaturesConfiguration(folderPath)?.codeSecurityEnabled;
  }

  protected getProductDisabledMessage(): string {
    return SNYK_ANALYSIS_STATUS.CODE_SECURITY_DISABLED;
  }

  onDidChangeTreeData = this.viewManagerService.refreshCodeSecurityViewEmitter.event;
}
