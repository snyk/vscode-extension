export interface IVSCodeClipboard {
  writeText(text: string): Thenable<void>;
}
