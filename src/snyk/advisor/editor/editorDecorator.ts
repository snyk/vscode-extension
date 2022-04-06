import { getRenderOptions, LineDecorations, updateDecorations } from '../../common/editor/editorDecorator';
import { HoverAdapter } from '../../common/vscode/hover';
import { IVSCodeLanguages } from '../../common/vscode/languages';
import { IMarkdownStringAdapter } from '../../common/vscode/markdownString';
import { IThemeColorAdapter } from '../../common/vscode/theme';
import { Hover, TextEditorDecorationType } from '../../common/vscode/types';
import { IVSCodeWindow } from '../../common/vscode/window';
import { AdvisorScore } from '../advisorTypes';
import { messages } from '../messages/messages';
import { IAdvisorApiClient } from '../services/advisorApiClient';

const { SCORE_PREFIX } = messages;

export default class EditorDecorator {
  private readonly decorationType: TextEditorDecorationType;
  private readonly editorLastCharacterIndex = Number.MAX_SAFE_INTEGER;
  private readonly fileDecorationLines: Map<string, LineDecorations> = new Map<string, LineDecorations>();

  constructor(
    private readonly window: IVSCodeWindow,
    private readonly languages: IVSCodeLanguages,
    private readonly themeColorAdapter: IThemeColorAdapter,
    private readonly advisorApiClient: IAdvisorApiClient,
    private readonly hoverAdapter: HoverAdapter,
    private readonly markdownStringAdapter: IMarkdownStringAdapter,
  ) {
    this.decorationType = this.window.createTextEditorDecorationType({
      after: { margin: '0 0 0 1rem' },
    });
  }

  addScoresDecorations(
    filePath: string,
    packageScore: AdvisorScore,
    line: number,
    decorations: LineDecorations = [],
  ): void {
    if (!packageScore) {
      return;
    }
    decorations[line] = {
      range: this.languages.createRange(
        line - 1,
        this.editorLastCharacterIndex,
        line - 1,
        this.editorLastCharacterIndex,
      ),
      renderOptions: getRenderOptions(
        `${SCORE_PREFIX} ${Math.round(packageScore.score * 100)}/100`,
        this.themeColorAdapter,
      ),
      hoverMessage: this.getHoverMessage(packageScore)?.contents,
    };

    this.fileDecorationLines.set(filePath, decorations);
    updateDecorations(this.window, filePath, decorations, this.decorationType);
  }

  getHoverMessage(score: AdvisorScore): Hover | null {
    if (!score) {
      return null;
    }
    const hoverMessageMarkdown = this.markdownStringAdapter.get(``);
    hoverMessageMarkdown.isTrusted = true;
    const hoverMessage = this.hoverAdapter.create(hoverMessageMarkdown);
    hoverMessageMarkdown.appendMarkdown('| |  | |  |');
    hoverMessageMarkdown.appendMarkdown('\n');
    hoverMessageMarkdown.appendMarkdown('| ---- | ---- | ---- |  :---- |');
    hoverMessageMarkdown.appendMarkdown('\n');
    Object.keys(score.labels).forEach(label => {
      hoverMessageMarkdown.appendMarkdown(`| ${label}: | | | ${score?.labels[label]} |`);
      hoverMessageMarkdown.appendMarkdown('\n');
    });
    hoverMessageMarkdown.appendMarkdown(
      `[More Details](${this.advisorApiClient.getAdvisorUrl('npm-package')}/${score.name})`,
    );

    return hoverMessage;
  }

  resetDecorations(filePath: string): void {
    const decorations: LineDecorations | undefined = this.fileDecorationLines.get(filePath);
    if (!decorations) {
      return;
    }

    const emptyDecorations = decorations.map(d => ({
      ...d,
      renderOptions: getRenderOptions('', this.themeColorAdapter),
    }));

    updateDecorations(this.window, filePath, emptyDecorations, this.decorationType);
  }
}
