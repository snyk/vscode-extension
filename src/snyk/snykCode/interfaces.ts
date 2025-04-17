import { TextDocument, TextDocumentContentChangeEvent } from '../common/vscode/types';

export type openedTextEditorType = {
  fullPath: string;
  workspace: string;
  lineCount: {
    current: number;
    prevOffset: number;
  };
  contentChanges: TextDocumentContentChangeEvent[];
  document: TextDocument;
};
