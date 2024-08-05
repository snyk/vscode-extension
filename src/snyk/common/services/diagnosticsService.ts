import * as vscode from 'vscode';
import { Issue, LsScanProduct, ScanProduct } from '../languageServer/types';

export interface IDiagnosticsIssueProvider<T> {
  getIssuesFromDiagnostics(product: ScanProduct): Issue<T>[];
}

export class DiagnosticsIssueProvider<T> implements IDiagnosticsIssueProvider<T> {
  getIssuesFromDiagnostics(product: ScanProduct): Issue<T>[] {
    const allDiagnostics = vscode.languages.getDiagnostics();
    const diagnosticsSource = this.productToLsProduct(product);

    // Filter and flatten the diagnostics list
    // Also filter only when diagnostic.data exists
    const filteredDiagnostics = allDiagnostics.flatMap(([_, diagnostics]) => {
      return diagnostics.filter(
        diagnostic => diagnostic.source === diagnosticsSource && diagnostic.hasOwnProperty('data'),
      );
    });
    const issues = filteredDiagnostics.map(this.mapDiagnosticToIssue);
    return issues;
  }

  private productToLsProduct(product: ScanProduct): LsScanProduct {
    switch (product) {
      case ScanProduct.Code:
        return LsScanProduct.Code;
      case ScanProduct.InfrastructureAsCode:
        return LsScanProduct.InfrastructureAsCode;
      case ScanProduct.OpenSource:
        return LsScanProduct.OpenSource;
      default:
        return LsScanProduct.Unknown;
    }
  }

  private mapDiagnosticToIssue(diagnostic: any): Issue<T> {
    return {
      id: diagnostic.data.id,
      title: diagnostic.data.title,
      severity: diagnostic.data.severity,
      filePath: diagnostic.data.filePath,
      additionalData: diagnostic.data.additionalData,
      isIgnored: diagnostic.data.isIgnored,
    };
  }
}
