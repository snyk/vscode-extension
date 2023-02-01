import { CodeAction, CodeActionProvider, Range, TextDocument } from '../../common/vscode/types';
import { CodeResult } from '../codeResult';

export class LspSnykCodeIssuesActionProvider implements CodeActionProvider {
  constructor(private readonly _issues: CodeResult) {}

  public provideCodeActions(document: TextDocument, clickedRange: Range): CodeAction[] | undefined {
    const uri = document.uri;

    return null;
  }
}
