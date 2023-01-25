import { IConfiguration } from '../../common/configuration/configuration';
import { configuration } from '../../common/configuration/instance';
import { SNYK_ANALYSIS_STATUS } from '../../common/constants/views';
import { IContextService } from '../../common/services/contextService';
import { IViewManagerService } from '../../common/services/viewManagerService';
import { TreeNode } from '../../common/views/treeNode';
import { ISnykCodeService } from '../codeService';
import { IssueTreeProvider } from './issueTreeProvider';

export class CodeQualityIssueTreeProvider extends IssueTreeProvider {
  constructor(
    protected viewManagerService: IViewManagerService,
    protected contextService: IContextService,
    protected codeService: ISnykCodeService,
    protected configuration: IConfiguration,
  ) {
    super(contextService, codeService, configuration, false);
  }

  getRootChildren(): TreeNode[] {
    if (!configuration.getFeaturesConfiguration()?.codeQualityEnabled) {
      return [
        new TreeNode({
          text: SNYK_ANALYSIS_STATUS.CODE_QUALITY_DISABLED,
        }),
      ];
    }

    return super.getRootChildren();
  }

  onDidChangeTreeData = this.viewManagerService.refreshCodeQualityViewEmitter.event;
}
