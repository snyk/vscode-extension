import { configuration } from '../../common/configuration/instance';
import { SNYK_ANALYSIS_STATUS } from '../../common/constants/views';
import { ISnykCodeService } from '../codeService';
import { IContextService } from '../../common/services/contextService';
import { IViewManagerService } from '../../common/services/viewManagerService';
import { IssueProvider } from './issueProvider';
import { TreeNode } from '../../common/views/treeNode';

export class CodeQualityIssueProvider extends IssueProvider {
  constructor(
    protected viewManagerService: IViewManagerService,
    protected contextService: IContextService,
    protected snykCode: ISnykCodeService,
  ) {
    super(contextService, snykCode, snykCode.analyzer.codeQualityReview);
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
