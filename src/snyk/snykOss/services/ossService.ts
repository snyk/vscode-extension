import { CliDownloadService } from '../../cli/services/cliDownloadService';
import { IExtension } from '../../base/modules/interfaces';
import { CliError, CliService } from '../../cli/services/cliService';
import { IConfiguration } from '../../common/configuration/configuration';
import { ILog } from '../../common/logger/interfaces';
import { INotificationService } from '../../common/services/notificationService';
import { IViewManagerService } from '../../common/services/viewManagerService';
import { ExtensionContext } from '../../common/vscode/extensionContext';
import { IVSCodeWorkspace } from '../../common/vscode/workspace';
import { messages } from '../messages/test';
import { OssResult, OssSeverity, OssVulnerability } from '../ossResult';
import { ISuggestionViewProvider } from '../views/suggestion/suggestionViewProvider';
import { OssIssueCommandArg } from '../views/vulnerabilityProvider';
import { DailyScanJob } from '../watchers/dailyScanJob';
import createManifestFileWatcher from '../watchers/manifestFileWatcher';

export class OssService extends CliService<OssResult> {
  protected readonly command: string[] = ['test'];

  private isVulnerabilityTreeVisible = false;

  constructor(
    protected readonly extensionContext: ExtensionContext,
    protected readonly logger: ILog,
    protected readonly config: IConfiguration,
    private readonly suggestionProvider: ISuggestionViewProvider,
    protected readonly workspace: IVSCodeWorkspace,
    private readonly viewManagerService: IViewManagerService,
    protected readonly downloadService: CliDownloadService,
    private readonly dailyScanJob: DailyScanJob,
    private readonly notificationService: INotificationService,
  ) {
    super(extensionContext, logger, config, workspace, downloadService);
  }

  public getResult = (): OssResult | undefined => this.result;

  protected mapToResultType(rawCliResult: string): OssResult {
    if (rawCliResult.length == 0) {
      throw new Error('CLI returned empty output result.');
    }

    const result = JSON.parse(rawCliResult) as OssResult;

    return result;
  }

  protected beforeTest(): void {
    this.logger.info(messages.testStarted);
    this.viewManagerService.refreshOssView();
  }

  protected afterTest(error?: CliError): void {
    if (error) {
      this.logger.error(`${messages.testFailed} ${error.error}`);
    } else {
      this.logger.info(messages.testFinished);
    }

    this.viewManagerService.refreshOssView();

    if (this.config.shouldAutoScanOss) {
      this.dailyScanJob.schedule();
    }
  }

  activateSuggestionProvider(): void {
    this.suggestionProvider.activate();
  }

  showSuggestionProvider(vulnerability: OssIssueCommandArg): Promise<void> {
    return this.suggestionProvider.showPanel(vulnerability);
  }

  activateManifestFileWatcher(extension: IExtension): void {
    const manifestWatcher = createManifestFileWatcher(extension, this.workspace, this.config);
    this.extensionContext.addDisposables(manifestWatcher);
  }

  setVulnerabilityTreeVisibility(visible: boolean): void {
    this.isVulnerabilityTreeVisible = visible;
  }

  async showBackgroundNotification(oldResult: OssResult): Promise<void> {
    if (this.isVulnerabilityTreeVisible || !this.config.shouldShowOssBackgroundScanNotification || !this.result) {
      return;
    }

    const newVulnerabilities = this.getNewCriticalVulnerabilitiesCount(this.result, oldResult);
    if (newVulnerabilities > 0) {
      await this.notificationService.showOssBackgroundScanNotification(newVulnerabilities);
    }
  }

  getUniqueVulnerabilities(vulnerabilities: OssVulnerability[]): OssVulnerability[] {
    return vulnerabilities.filter((val, i, arr) => arr.findIndex(el => el.id === val.id) == i);
  }

  getNewCriticalVulnerabilitiesCount(currentResult: OssResult, otherResult: OssResult): number {
    if (Array.isArray(currentResult) && Array.isArray(otherResult)) {
      let newVulnerabilityCount = 0;
      for (let i = 0; i < otherResult.length; i++) {
        newVulnerabilityCount += this.getNewCriticalVulnerabilitiesCount(currentResult[i], otherResult[i]);
      }

      return newVulnerabilityCount;
    }

    // if only one of results is an array, no count possible
    if (Array.isArray(currentResult) || Array.isArray(otherResult)) {
      throw new Error('Result types mismatch for new vulnerabilities calculation.');
    }

    if (!currentResult) {
      return otherResult.vulnerabilities.length;
    }

    const currentVulnSet = this.getUniqueVulnerabilities(currentResult.vulnerabilities).filter(
      v => v.severity === OssSeverity.Critical,
    );
    const otherVulnSet = this.getUniqueVulnerabilities(otherResult.vulnerabilities).filter(
      v => v.severity === OssSeverity.Critical,
    );

    if (currentVulnSet.length > otherVulnSet.length) {
      return currentVulnSet.length - otherVulnSet.length;
    }

    return 0;
  }
}
