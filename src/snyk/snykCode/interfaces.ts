import { IAnalysisResult, IFilePath, IFileSuggestion, ISuggestion } from '@snyk/code-client';
import * as vscode from 'vscode';
import { DiagnosticCollection, TextDocument } from 'vscode';
import { IExtension } from '../base/modules/interfaces';

export type completeFileSuggestionType = ICodeSuggestion &
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

export interface IIssuesListOptions {
  fileIssuesList: IFilePath;
  suggestions: ICodeSuggestions;
  fileUri: vscode.Uri;
}

export type ICodeSuggestion = ISuggestion & {
  isSecurityType: boolean;
};

interface ICodeSuggestions {
  [suggestionIndex: string]: ICodeSuggestion;
}

export interface ISnykCodeResult extends IAnalysisResult {
  suggestions: ICodeSuggestions;
}

export interface ISnykCodeAnalyzer {
  codeSecurityReview: DiagnosticCollection | undefined;
  codeQualityReview: DiagnosticCollection | undefined;
  setAnalysisResults(results: IAnalysisResult): void;
  getAnalysisResults(): ISnykCodeResult;
  findSuggestion(suggestionName: string): ICodeSuggestion | undefined;
  getFullSuggestion(
    suggestionId: string,
    uri: vscode.Uri,
    position: vscode.Range,
  ): completeFileSuggestionType | undefined;
  checkFullSuggestion(suggestion: completeFileSuggestionType): boolean;
  createReviewResults(): void;
  updateReviewResultsPositions(extension: IExtension, updatedFile: openedTextEditorType): Promise<void>;
}
