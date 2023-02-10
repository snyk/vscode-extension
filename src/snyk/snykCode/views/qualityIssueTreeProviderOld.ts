import { IConfiguration } from '../../common/configuration/configuration';
import { configuration } from '../../common/configuration/instance';
import { SNYK_ANALYSIS_STATUS } from '../../common/constants/views';
import { IContextService } from '../../common/services/contextService';
import { IViewManagerService } from '../../common/services/viewManagerService';
import { TreeNode } from '../../common/views/treeNode';
import { ISnykCodeServiceOld } from '../codeServiceOld';
import { IssueTreeProviderOld } from './issueTreeProviderOld';

export class CodeQualityIssueTreeProviderOld extends IssueTreeProviderOld {
  constructor(
    protected viewManagerService: IViewManagerService,
    protected contextService: IContextService,
    protected snykCode: ISnykCodeServiceOld,
    protected configuration: IConfiguration,
  ) {
    super(contextService, snykCode, snykCode.analyzer.codeQualityReview, configuration);
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

  onDidChangeTreeData = this.viewManagerService.refreshOldCodeQualityViewEmitter.event;
}
