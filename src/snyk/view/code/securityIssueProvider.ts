import { AnalyzerInterface } from '../../../interfaces/SnykInterfaces';
import { configuration } from '../../configuration';
import { SNYK_ANALYSIS_STATUS } from '../../constants/views';
import { ISnykCode } from '../../lib/modules/code';
import { IContextService } from '../../services/contextService';
import { IViewManagerService } from '../../services/viewManagerService';
import { IssueProvider } from '../IssueProvider';
import { Node } from '../node';

export class CodeSecurityIssueProvider extends IssueProvider {
  constructor(
    protected viewManagerService: IViewManagerService,
    protected analyzer: AnalyzerInterface,
    protected contextService: IContextService,
    protected snykCode: ISnykCode,
  ) {
    super(contextService, snykCode, analyzer.codeSecurityReview);
  }

  getRootChildren(): Node[] {
    this.viewManagerService.emitViewInitialized();

    if (!configuration.getFeaturesConfiguration()?.codeSecurityEnabled) {
      return [
        new Node({
          text: SNYK_ANALYSIS_STATUS.CODE_SECURITY_DISABLED,
        }),
      ];
    }

    return super.getRootChildren();
  }

  onDidChangeTreeData = this.viewManagerService.refreshCodeSecurityViewEmitter.event;
}
