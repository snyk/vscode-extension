import { TextDocument } from 'vscode';

export type openedTextEditorType = {
  fullPath: string;
  workspace: string;
  lineCount: {
    current: number;
    prevOffset: number;
  };
  contentChanges: unknown[];
  document: TextDocument;
};
