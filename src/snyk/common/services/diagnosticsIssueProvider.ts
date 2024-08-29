import * as vscode from 'vscode';
import { CodeIssueData, IacIssueData, Issue, LsScanProduct, OssIssueData, ScanProduct } from '../languageServer/types';

// This is a workaround until the LanguageClient package adds data to the Diagnostic type
// according to https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#diagnostic
// Since 3.16 the property data was introduced
class Diagnostic316 extends vscode.Diagnostic {
  data: Issue<CodeIssueData | OssIssueData | IacIssueData>;
}

export interface IDiagnosticsIssueProvider {
  getIssuesFromDiagnostics(product: ScanProduct): Issue<CodeIssueData | OssIssueData | IacIssueData>[];

  getDiagnostics(product: ScanProduct): Diagnostic316[];
}

export class DiagnosticsIssueProvider implements IDiagnosticsIssueProvider {
  getDiagnostics(product: ScanProduct): Diagnostic316[] {
    const allDiagnostics = vscode.languages.getDiagnostics();
    const diagnosticsSource = this.productToLsProduct(product);

    // Filter and flatten the diagnostics list
    // Also filter only when diagnostic.data exists
    return allDiagnostics.flatMap(([_, diagnostics]) => {
      return diagnostics.filter((diagnostic): diagnostic is Diagnostic316 => diagnostic.source === diagnosticsSource);
    });
  }

  getIssuesFromDiagnostics(product: ScanProduct): Issue<CodeIssueData | OssIssueData | IacIssueData>[] {
    const filteredDiagnostics = this.getDiagnostics(product).filter(diagnostic => diagnostic.data);
    return filteredDiagnostics.map(diagnostic => diagnostic.data);
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
