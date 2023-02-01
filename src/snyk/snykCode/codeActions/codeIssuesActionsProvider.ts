import { ICodeActionKindAdapter } from '../../common/vscode/codeAction';
import { CodeAction, CodeActionKind, CodeActionProvider, Range, TextDocument } from '../../common/vscode/types';
import { CodeResult } from '../codeResult';

export class SnykCodeActionsProvider implements CodeActionProvider {
  private readonly providedCodeActionKinds = [this.codeActionKindProvider.getQuickFix()];

  constructor(
    private readonly issues: Readonly<CodeResult>,
    private readonly codeActionKindProvider: ICodeActionKindAdapter,
  ) {}

  getProvidedCodeActionKinds(): CodeActionKind[] {
    return this.providedCodeActionKinds;
  }

  public provideCodeActions(document: TextDocument, _clickedRange: Range): CodeAction[] | undefined {
    const uri = document.uri;

    return undefined;
  }
}
