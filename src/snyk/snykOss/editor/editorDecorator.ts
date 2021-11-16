import _ from 'lodash';
import { IVSCodeLanguages } from '../../common/vscode/languages';
import { IThemeColorAdapter } from '../../common/vscode/theme';
import {
  DecorationOptions,
  TextEditorDecorationType,
  ThemableDecorationInstanceRenderOptions,
} from '../../common/vscode/types';
import { IVSCodeWindow } from '../../common/vscode/window';
import { messages } from '../messages/vulnerabilityCount';
import { ImportedModule, ModuleVulnerabilityCount } from '../services/vulnerabilityCount/importedModule';

type LineDecorations = DecorationOptions[]; // array index is a line number

export class EditorDecorator {
  private readonly decorationType: TextEditorDecorationType;
  private readonly fileDecorationMap: Map<string, LineDecorations>;
  private readonly editorLastCharacterIndex = Number.MAX_SAFE_INTEGER;

  private updateTimeout: NodeJS.Timer | undefined = undefined;

  constructor(
    private readonly window: IVSCodeWindow,
    private readonly languages: IVSCodeLanguages,
    private readonly themeColorAdapter: IThemeColorAdapter,
  ) {
    this.fileDecorationMap = new Map<string, LineDecorations>();
    this.decorationType = this.window.createTextEditorDecorationType({
      after: { margin: '0 0 0 1rem' },
    });
  }

  get fileDecorations(): ReadonlyMap<string, LineDecorations> {
    return this.fileDecorationMap;
  }

  resetDecorations(filePath: string): void {
    const decorations = this.fileDecorationMap.get(filePath);
    if (!decorations) {
      return;
    }

    const emptyDecorations = decorations.map(d => ({
      ...d,
      renderOptions: this.getRenderOptions(''),
    }));
    this.fileDecorationMap.set(filePath, emptyDecorations);
    this.triggerUpdateDecorations(filePath);
  }

  setScanStartDecorations(filePath: string, modules: ImportedModule[]): void {
    const lineDecorations: LineDecorations = [];

    for (const module of modules) {
      if (module.line == null) {
        continue;
      }

      lineDecorations[module.line] = {
        range: this.languages.createRange(
          module.line - 1,
          this.editorLastCharacterIndex,
          module.line - 1,
          this.editorLastCharacterIndex,
        ),
        renderOptions: this.getRenderOptions(messages.fetchingVulnerabilities),
      };
    }

    if (!lineDecorations.length) {
      // return early when no decorations have been created
      return;
    }

    this.fileDecorationMap.set(filePath, lineDecorations);
    this.triggerUpdateDecorations(filePath);
  }

  setScanDoneDecorations(filePath: string, vulnerabilityCounts: ModuleVulnerabilityCount[]): void {
    for (const moduleVulnerabilityCount of vulnerabilityCounts) {
      this.setScannedDecoration(moduleVulnerabilityCount, false);
    }

    this.triggerUpdateDecorations(filePath);
  }

  setScannedDecoration(vulnerabilityCount: ModuleVulnerabilityCount, triggerUpdate = true): void {
    if (_.isNull(vulnerabilityCount.line)) {
      return;
    }

    const filePath = vulnerabilityCount.fileName;

    let lineDecorations = this.fileDecorationMap.get(filePath);
    if (!lineDecorations) {
      lineDecorations = [];
      this.fileDecorationMap.set(filePath, lineDecorations); // set map, if no decoration was set before
    }

    const text = vulnerabilityCount.count ? messages.decoratorMessage(vulnerabilityCount.count) : '';

    lineDecorations[vulnerabilityCount.line] = {
      range: this.languages.createRange(
        vulnerabilityCount.line - 1,
        this.editorLastCharacterIndex,
        vulnerabilityCount.line - 1,
        this.editorLastCharacterIndex,
      ),
      renderOptions: this.getRenderOptions(text),
    };

    if (triggerUpdate) {
      this.triggerUpdateDecorations(filePath, 500);
    }
  }

  updateDecorations(filePath: string): void {
    const visibleEditors = this.window.getVisibleTextEditors().filter(editor => editor.document.fileName === filePath);

    for (const editor of visibleEditors) {
      const decorations = this.fileDecorationMap.get(filePath);

      if (decorations && decorations.length) {
        editor.setDecorations(
          this.decorationType,
          decorations.filter(d => !!d),
        );
      }
    }
  }

  private triggerUpdateDecorations(filePath: string, updateTimeoutInMs = 10): void {
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
      this.updateTimeout = undefined;
    }

    this.updateTimeout = setTimeout(() => this.updateDecorations(filePath), updateTimeoutInMs);
  }

  private getRenderOptions(contentText: string): ThemableDecorationInstanceRenderOptions {
    const color = this.themeColorAdapter.create('descriptionForeground');
    const fontWeight = 'normal';

    return {
      after: {
        contentText,
        color,
        fontWeight,
      },
    };
  }
}
