import {
  CancellationToken,
  CodeAction,
  CodeActionContext,
  Command,
  ProviderResult,
  Range,
  Selection,
  TextDocument,
} from 'vscode';
import { CodeActionProvider } from '../../common/vscode/types';
import { CodeResult } from '../codeResult';

export class LspSnykCodeIssuesActionProvider implements CodeActionProvider {
  constructor(private readonly _issues: CodeResult) {}

  provideCodeActions(
    document: TextDocument,
    range: Range | Selection,
    context: CodeActionContext,
    token: CancellationToken,
  ): ProviderResult<(CodeAction | Command)[]> {
    const uri = document.uri;

    return null;
  }
}
