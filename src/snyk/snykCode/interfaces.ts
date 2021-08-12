import { IAnalysisResult, IFilePath, IFileSuggestion, ISuggestion, ISuggestions } from '@snyk/code-client';
import * as vscode from 'vscode';
import { DiagnosticCollection, TextDocument } from 'vscode';
import { IExtension } from '../base/modules/interfaces';

export type completeFileSuggestionType = ISuggestion &
  IFileSuggestion & {
    uri: string;
    isSecurityType: boolean;
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
  suggestions: ISuggestions;
  fileUri: vscode.Uri;
}

export interface ISnykCodeAnalyzer {
  codeSecurityReview: DiagnosticCollection | undefined;
  codeQualityReview: DiagnosticCollection | undefined;
  analysisResults: IAnalysisResult;
  findSuggestion(suggestionName: string): ISuggestion | undefined;
  getFullSuggestion(
    suggestionId: string,
    uri: vscode.Uri,
    position: vscode.Range,
  ): completeFileSuggestionType | undefined;
  checkFullSuggestion(suggestion: completeFileSuggestionType): boolean;
  createReviewResults(): void;
  updateReviewResultsPositions(extension: IExtension, updatedFile: openedTextEditorType): Promise<void>;
}
