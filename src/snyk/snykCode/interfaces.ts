import { AnalysisResultLegacy, FilePath, FileSuggestion, Suggestion } from '@snyk/code-client';
import * as vscode from 'vscode';
import { DiagnosticCollection, TextDocument } from 'vscode';
import { IExtension } from '../base/modules/interfaces';
import { IHoverAdapter } from '../common/vscode/hover';
import { IMarkdownStringAdapter } from '../common/vscode/markdownString';
import { Disposable } from '../common/vscode/types';

export type completeFileSuggestionType = ICodeSuggestion &
  FileSuggestion & {
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

export interface IIssuesListOptions {
  fileIssuesList: FilePath;
  suggestions: Readonly<ICodeSuggestions>;
  fileUri: vscode.Uri;
}

export type ICodeSuggestion = Suggestion & {
  isSecurityType: boolean;
};

interface ICodeSuggestions {
  [suggestionIndex: string]: Readonly<ICodeSuggestion>;
}

export interface ISnykCodeResult extends AnalysisResultLegacy {
  suggestions: Readonly<ICodeSuggestions>;
}

export interface ISnykCodeAnalyzer extends Disposable {
  codeSecurityReview: DiagnosticCollection | undefined;
  codeQualityReview: DiagnosticCollection | undefined;

  registerHoverProviders(
    codeSecurityHoverAdapter: IHoverAdapter,
    codeQualityHoverAdapter: IHoverAdapter,
    markdownStringAdapter: IMarkdownStringAdapter,
  ): void;
  registerCodeActionProviders(
    codeSecurityCodeActionsProvider: Disposable,
    codeQualityCodeActionsProvider: Disposable,
  ): void;

  setAnalysisResults(results: AnalysisResultLegacy): void;
  getAnalysisResults(): Readonly<ISnykCodeResult>;
  findSuggestion(diagnostic: vscode.Diagnostic): Readonly<ICodeSuggestion | undefined>;
  getFullSuggestion(
    suggestionId: string,
    uri: vscode.Uri,
    position: vscode.Range,
  ): Readonly<completeFileSuggestionType | undefined>;
  checkFullSuggestion(suggestion: completeFileSuggestionType): boolean;
  createReviewResults(): void;
  updateReviewResultsPositions(extension: IExtension, updatedFile: openedTextEditorType): Promise<void>;
  refreshDiagnostics(): void;
}
