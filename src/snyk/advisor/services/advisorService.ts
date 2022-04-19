import { Subscription } from 'rxjs';
import { IConfiguration } from '../../common/configuration/configuration';
import { LineDecorations } from '../../common/editor/editorDecorator';
import { ILog } from '../../common/logger/interfaces';
import { getSupportedLanguage, isValidModuleName } from '../../common/parsing';
import { ModuleParserProvider } from '../../common/services/moduleParserProvider';
import { ImportedModule, Language } from '../../common/types';
import { HoverAdapter } from '../../common/vscode/hover';
import { IVSCodeLanguages } from '../../common/vscode/languages';
import { IMarkdownStringAdapter } from '../../common/vscode/markdownString';
import { IThemeColorAdapter } from '../../common/vscode/theme';
import { Disposable, TextDocument, TextEditor } from '../../common/vscode/types';
import { IVSCodeWindow } from '../../common/vscode/window';
import { IVSCodeWorkspace } from '../../common/vscode/workspace';
import { AdvisorScore } from '../advisorTypes';
import EditorDecorator from '../editor/editorDecorator';
import { IAdvisorApiClient } from './advisorApiClient';
import AdvisorProvider from './advisorProvider';

const SCORE_THRESHOLD = 0.7;
export class AdvisorService implements Disposable {
  protected disposables: Disposable[] = [];
  protected advisorScanFinishedSubscription: Subscription;
  protected activeEditor: TextEditor | undefined;

  private readonly editorDecorator: EditorDecorator;

  constructor(
    private readonly window: IVSCodeWindow,
    private readonly languages: IVSCodeLanguages,
    private readonly advisorProvider: AdvisorProvider,
    private readonly logger: ILog,
    private readonly workspace: IVSCodeWorkspace,
    private readonly advisorApiClient: IAdvisorApiClient,
    private readonly themeColorAdapter: IThemeColorAdapter,
    private readonly hoverAdapter: HoverAdapter,
    private readonly markdownStringAdapter: IMarkdownStringAdapter,
    private readonly configuration: IConfiguration,
  ) {
    this.editorDecorator = new EditorDecorator(
      window,
      this.languages,
      this.themeColorAdapter,
      this.advisorApiClient,
      this.hoverAdapter,
      this.markdownStringAdapter,
    );
  }

  async activate(): Promise<void> {
    if (!this.configuration.getPreviewFeatures().advisor) {
      return;
    }

    this.activeEditor = this.window.getActiveTextEditor();
    this.registerEditorListeners();
    if (!this.activeEditor) {
      return;
    }

    await this.handleEditorEvent(this.activeEditor.document);
  }

  registerEditorListeners(): void {
    this.disposables.push(
      this.workspace.onDidChangeTextDocument(async ev => {
        if (ev?.contentChanges.length) {
          this.editorDecorator.resetDecorations(ev.document.fileName);
        }
        await this.handleEditorEvent(ev.document);
      }),
      this.window.onDidChangeActiveTextEditor(async ev => {
        if (!ev) {
          return;
        }
        await this.handleEditorEvent(ev.document);
      }),
    );
  }

  async handleEditorEvent(document: TextDocument): Promise<void> {
    const { fileName, languageId } = document;
    const supportedLanguage = getSupportedLanguage(fileName, languageId);
    if (document.isDirty || !supportedLanguage) {
      return;
    }

    const modules = this.getModules(fileName, document.getText(), supportedLanguage, this.logger).filter(
      isValidModuleName,
    );

    const scores = await this.advisorProvider.getScores(modules);
    this.processScores(scores, modules, fileName);
  }

  processScores(scores: AdvisorScore[], modules: ImportedModule[], fileName: string): void {
    const vulnsLineDecorations: Map<string, number> = new Map<string, number>();
    modules.forEach(({ name, line }) => {
      vulnsLineDecorations.set(name, line || -1);
    });
    const decorations: LineDecorations = [];
    for (const [packageName, line] of vulnsLineDecorations) {
      if (line < 0) {
        continue;
      }
      const packageScore = scores.find(score => score && score.name === packageName);
      if (!packageScore || packageScore.score >= SCORE_THRESHOLD) {
        continue;
      }

      this.editorDecorator.addScoresDecorations(fileName, packageScore, line, decorations);
    }
  }

  private getModules(fileName: string, source: string, language: Language, logger: ILog): ImportedModule[] {
    const parser = ModuleParserProvider.getInstance(language, logger, this.configuration);
    if (!parser) {
      return [];
    }

    return parser.getModules(fileName, source, language);
  }

  dispose(): void {
    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}
