import * as vscode from 'vscode';
import { Issue, LsScanProduct, ScanProduct } from '../languageServer/types';

// This is a workaround until the LanguageClient package adds data to the Diagnostic type
// according to https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#diagnostic
// Since 3.16 the property data was introduced
class Diagnostic316<T> extends vscode.Diagnostic {
  data: Issue<T>;
}

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
        (diagnostic): diagnostic is Diagnostic316<T> =>
          diagnostic.source === diagnosticsSource && diagnostic.hasOwnProperty('data'),
      );
    });
    const issues = filteredDiagnostics.map(diagnostic => diagnostic.data);
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
}
