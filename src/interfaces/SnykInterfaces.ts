import { IAnalysisResult, IFileBundle, IFilePath, IFileSuggestion, ISuggestion, ISuggestions } from '@snyk/code-client';
import * as vscode from 'vscode';
import { DiagnosticCollection, ExtensionContext, StatusBarItem, TextDocument, TextEditor } from 'vscode';
import { IContextService } from '../snyk/services/contextService';
import { IOpenerService } from '../snyk/services/openerService';
import { Iteratively } from '../snyk/analytics/itly';

export interface StatusBarItemInterface {
  snykStatusBarItem: StatusBarItem;
  show(): void;
}

export interface BaseSnykModuleInterface {
  analysisStatus: string;
  analysisProgress: string;
  remoteBundle: IFileBundle;
  changedFiles: Set<string>;
  analyzer: AnalyzerInterface;
  statusBarItem: StatusBarItemInterface;
  filesWatcher: vscode.FileSystemWatcher;
  settingsWatcher: SnykWatcherInterface;
  contextService: IContextService;
  openerService: IOpenerService;
  shouldShowAnalysis: boolean;
  emitViewInitialized(): void;
  analytics: Iteratively;
  loadAnalytics(): void;

  // Abstract methods
  processError(error: errorType, options?: { [key: string]: any }): Promise<void>;
  startExtension(): Promise<void>;
}

export interface ReportModuleInterface {
  resetTransientErrors(): void;
}

export interface LoginModuleInterface {
  initiateLogin(): Promise<void>;
  checkSession(): Promise<string>;
  checkCodeEnabled(): Promise<boolean>;
  checkAdvancedMode(): Promise<void>;
}

export interface BundlesModuleInterface {
  readonly runningAnalysis: boolean;
  readonly lastAnalysisDuration: number;
  readonly lastAnalysisTimestamp: number;
  startAnalysis(manual: boolean): Promise<void>;
}

export interface SnykLibInterface {
  setMode(mode: string): void;
  enableCode(): Promise<void>;
}

export interface ExtensionInterface
  extends BaseSnykModuleInterface,
    ReportModuleInterface,
    LoginModuleInterface,
    BundlesModuleInterface,
    SnykLibInterface {
  context: vscode.ExtensionContext | undefined;
  activate(context: ExtensionContext): void;
}

export interface SnykWatcherInterface {
  activate(extension: ExtensionInterface | any): void;
}

export interface SuggestionProviderInterface {
  activate(extension: ExtensionInterface): void;
  show(suggestionId: string, uri: vscode.Uri, position: vscode.Range): void;
  checkCurrentSuggestion(): void;
}

export type userStateItemType = string | number | boolean | undefined;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type errorType = Error | any;

export type filesForSaveListType = string[];

export type completeFileSuggestionType = ISuggestion &
  IFileSuggestion & {
    uri: string;
  };

export type openedTextEditorType = {
  fullPath: string;
  workspace: string;
  lineCount: {
    current: number;
    prevOffset: number;
  };
  contentChanges: any[];
  document: TextDocument;
};

export interface StateIitemsInterface {
  [key: string]: string;
}

export interface SingleIssuePositionInterface {
  cols: number[];
  rows: number[];
}

export interface IssuesListOptionsInterface {
  fileIssuesList: IFilePath;
  suggestions: ISuggestions;
  fileUri: vscode.Uri;
}

export interface AnalyzerInterface {
  activate(extension: ExtensionInterface | any): void;
  snykReview: DiagnosticCollection | undefined;
  analysisResults: IAnalysisResult;
  findSuggestion(suggestionName: string): ISuggestion | undefined;
  getFullSuggestion(
    suggestionId: string,
    uri: vscode.Uri,
    position: vscode.Range,
  ): completeFileSuggestionType | undefined;
  checkFullSuggestion(suggestion: completeFileSuggestionType): boolean;
  createReviewResults(): void;
  updateReviewResultsPositions(extension: ExtensionInterface, updatedFile: openedTextEditorType): Promise<void>;
  setIssuesMarkersDecoration(editor: TextEditor | undefined): void;
}
