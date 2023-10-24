import * as marked from 'marked';
import { Subject, Subscription } from 'rxjs';
import { IExtension } from '../../base/modules/interfaces';
import { CliError } from '../../cli/services/cliService';
import { IAnalytics } from '../../common/analytics/itly';
import { IConfiguration } from '../../common/configuration/configuration';
import { IWorkspaceTrust } from '../../common/configuration/trustedFolders';
import { IDE_NAME } from '../../common/constants/general';
import { ILanguageServer } from '../../common/languageServer/languageServer';
import { OssIssueData, Scan, ScanProduct } from '../../common/languageServer/types';
import { ILog } from '../../common/logger/interfaces';
import { ProductService } from '../../common/services/productService';
import { IViewManagerService } from '../../common/services/viewManagerService';
import { ICodeActionAdapter, ICodeActionKindAdapter } from '../../common/vscode/codeAction';
import { ExtensionContext } from '../../common/vscode/extensionContext';
import { IVSCodeLanguages } from '../../common/vscode/languages';
import { IVSCodeWorkspace } from '../../common/vscode/workspace';
import { OssCodeActionsProvider } from '../codeActions/ossCodeActionsProvider';
import { messages } from '../messages/test';
import { OssFileResult, OssResult, OssSeverity, OssVulnerability, isResultCliError } from '../ossResult';
import { IOssSuggestionWebviewProvider } from '../views/interfaces';
import { OssIssueCommandArg } from '../views/ossVulnerabilityTreeProvider';
import createManifestFileWatcher from '../watchers/manifestFileWatcher';

export class OssService extends ProductService<OssIssueData> {
  protected readonly command: string[] = ['test'];

  private isVulnerabilityTreeVisible = false;

  readonly scanFinished$ = new Subject<void>();

  constructor(
    extensionContext: ExtensionContext,
    config: IConfiguration,
    suggestionProvider: IOssSuggestionWebviewProvider,
    readonly codeActionAdapter: ICodeActionAdapter,
    readonly codeActionKindAdapter: ICodeActionKindAdapter,
    viewManagerService: IViewManagerService,
    workspace: IVSCodeWorkspace,
    workspaceTrust: IWorkspaceTrust,
    languageServer: ILanguageServer,
    languages: IVSCodeLanguages,
    logger: ILog,
    readonly analytics: IAnalytics,
  ) {
    super(
      extensionContext,
      config,
      suggestionProvider,
      viewManagerService,
      workspace,
      workspaceTrust,
      languageServer,
      languages,
      logger,
    );

    this.registerCodeActionsProvider(
      new OssCodeActionsProvider(this.result, codeActionAdapter, codeActionKindAdapter, languages, analytics),
    );
  }

  subscribeToLsScanMessages(): Subscription {
    return this.languageServer.scan$.subscribe((scan: Scan<OssIssueData>) => {
      if (scan.product !== ScanProduct.OpenSource) {
        return;
      }

      super.handleLsScanMessage(scan);
    });
  }

  refreshTreeView() {
    this.viewManagerService.refreshOssView();
  }

  public getResultArray = (): ReadonlyArray<OssFileResult> | undefined => {
    if (!this.result) {
      return undefined;
    }

    return Array.isArray(this.result) ? this.result : [this.result];
  };

  protected mapToResultType(rawCliResult: string): OssResult {
    if (rawCliResult.length == 0) {
      throw new Error('CLI returned empty output result.');
    }

    let result: OssResult;
    try {
      result = JSON.parse(rawCliResult) as OssResult;
    } catch (err) {
      throw new Error(`Failed to parse JSON result. Unparsed: ${rawCliResult}`);
    }

    return result;
  }

  protected ensureDependencies(): void {
    this.viewManagerService.refreshOssView();
    this.logger.info('Waiting for Open Source scan CLI readiness');
  }

  protected beforeTest(manualTrigger: boolean, reportTriggeredEvent: boolean): void {
    this.logger.info(messages.testStarted);
    this.viewManagerService.refreshOssView();

    if (reportTriggeredEvent) {
      this.analytics.logAnalysisIsTriggered({
        analysisType: ['Snyk Open Source'],
        ide: IDE_NAME,
        triggeredByUser: manualTrigger,
      });
    }
  }

  protected afterTest(result: OssResult | CliError): void {
    if (result instanceof CliError) {
      this.logger.error(`${messages.testFailed} ${result.error}`);
      this.logAnalysisIsReady('Error');
    } else {
      this.logOssResult(result);

      if (this.config.shouldAutoScanOss) {
        this.dailyScanJob.schedule();
      }
    }

    this.scanFinished$.next();
    this.viewManagerService.refreshOssView();
  }

  override handleLsDownloadFailure(): void {
    super.handleLsDownloadFailure();
    this.viewManagerService.refreshOssView();
  }

  override handleNoTrustedFolders(): void {
    super.handleNoTrustedFolders();
    this.viewManagerService.refreshOssView();
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

    if (!currentResult || isResultCliError(currentResult)) {
      return 0;
    }

    const currentVulnSet = this.getUniqueVulnerabilities(currentResult.vulnerabilities).filter(
      v => v.severity === OssSeverity.Critical,
    );

    if (isResultCliError(otherResult)) {
      return currentVulnSet.length;
    }

    const otherVulnSet = this.getUniqueVulnerabilities(otherResult.vulnerabilities).filter(
      v => v.severity === OssSeverity.Critical,
    );

    if (currentVulnSet.length > otherVulnSet.length) {
      return currentVulnSet.length - otherVulnSet.length;
    }

    return 0;
  }

  getOssIssueCommandArg(
    vulnerability: OssVulnerability,
    allVulnerabilities: OssVulnerability[],
  ): Promise<OssIssueCommandArg> {
    return new Promise((resolve, reject) => {
      const matchingIdVulnerabilities = allVulnerabilities.filter(v => v.id === vulnerability.id);
      marked.parse(vulnerability.description, (err, overviewHtml) => {
        if (err) {
          return reject(err);
        }

        return resolve({
          ...vulnerability,
          matchingIdVulnerabilities: matchingIdVulnerabilities,
          overviewHtml,
        });
      });
    });
  }

  private logOssResult(result: OssResult) {
    const fileResults = Array.isArray(result) ? result : [result];

    for (const fileResult of fileResults) {
      if (isResultCliError(fileResult)) {
        this.logger.error(this.getTestErrorMessage(fileResult));
        this.logAnalysisIsReady('Error');
      } else {
        this.logger.info(messages.testFinished(fileResult.projectName));
        this.logAnalysisIsReady('Success');
      }
    }
  }

  private getTestErrorMessage(fileResult: CliError): string {
    let errorMessage: string;
    if (fileResult.path) {
      errorMessage = `${messages.testFailedForPath(fileResult.path)} ${fileResult.error}`;
    } else {
      errorMessage = `${messages.testFailed} ${fileResult.error}`;
    }
    return errorMessage;
  }

  private logAnalysisIsReady(result: 'Error' | 'Success'): void {
    this.analytics.logAnalysisIsReady({
      ide: IDE_NAME,
      analysisType: 'Snyk Open Source',
      result,
    });
  }
}
