import { AnalyzerInterface } from '../../../interfaces/SnykInterfaces';
import { configuration } from '../../configuration';
import { SNYK_ANALYSIS_STATUS } from '../../constants/views';
import { ISnykCode } from '../../lib/modules/code';
import { IContextService } from '../../services/contextService';
import { IViewManagerService } from '../../services/viewManagerService';
import { IssueProvider } from '../IssueProvider';
import { Node } from '../node';

export class CodeQualityIssueProvider extends IssueProvider {
  constructor(
    protected viewManagerService: IViewManagerService,
    protected analyzer: AnalyzerInterface,
    protected contextService: IContextService,
    protected snykCode: ISnykCode,
  ) {
    super(contextService, snykCode, analyzer.codeQualityReview);
  }

  getRootChildren(): Node[] {
    this.viewManagerService.emitViewInitialized();

    if (!configuration.getFeaturesConfiguration()?.codeQualityEnabled) {
      return [
        new Node({
          text: SNYK_ANALYSIS_STATUS.CODE_QUALITY_DISABLED,
        }),
      ];
    }

    return super.getRootChildren();
  }

  onDidChangeTreeData = this.viewManagerService.refreshCodeQualityViewEmitter.event;
}
