import { strictEqual } from 'assert';
import sinon from 'sinon';
import AdvisorProvider from '../../../../snyk/advisor/services/advisorProvider';
import { AdvisorService } from '../../../../snyk/advisor/services/advisorService';
import { IConfiguration } from '../../../../snyk/common/configuration/configuration';
import { PJSON } from '../../../../snyk/common/constants/languageConsts';
import { HoverAdapter } from '../../../../snyk/common/vscode/hover';
import { IMarkdownStringAdapter } from '../../../../snyk/common/vscode/markdownString';
import { ThemeColorAdapter } from '../../../../snyk/common/vscode/theme';
import { TextDocument, TextDocumentChangeEvent, TextEditor } from '../../../../snyk/common/vscode/types';
import { LoggerMock } from '../../mocks/logger.mock';
import { advisorApiClientStub, advisorStubLanguages, advisorStubWindow, advisorStubWorkspace } from './advisorStubs';

suite('Advisor AdvisorService', () => {
  let advisorService: AdvisorService;
  let advisorProvider: AdvisorProvider;

  const loggerMock = new LoggerMock();

  setup(() => {
    advisorProvider = new AdvisorProvider(advisorApiClientStub, loggerMock);
    advisorProvider.getScores = sinon.fake.returns([]);
    advisorService = new AdvisorService(
      advisorStubWindow,
      advisorStubLanguages,
      advisorProvider,
      loggerMock,
      advisorStubWorkspace,
      advisorApiClientStub,
      {} as ThemeColorAdapter,
      {} as HoverAdapter,
      {} as IMarkdownStringAdapter,
      {
        getAdditionalCliParameters: () => undefined,
        getPreviewFeatures: () => {
          return {
            advisor: true,
          };
        },
      } as unknown as IConfiguration,
    );
  });

  teardown(() => {
    sinon.restore();
  });

  test('Attaches onDidChangeTextDocument listener on activation', async () => {
    advisorStubWindow.onDidChangeActiveTextEditor = sinon.fake();
    const onDidChangeTextDocumentSpy = sinon.fake();
    advisorStubWorkspace.onDidChangeTextDocument = onDidChangeTextDocumentSpy;

    await advisorService.activate();

    strictEqual(onDidChangeTextDocumentSpy.calledOnce, true);
  });

  test('Attaches onDidChangeActiveTextEditor listener on activation', async () => {
    advisorStubWorkspace.onDidChangeTextDocument = sinon.fake();

    const onDidChangeActiveTextEditor = sinon.fake();
    advisorStubWindow.onDidChangeActiveTextEditor = onDidChangeActiveTextEditor;

    await advisorService.activate();

    strictEqual(onDidChangeActiveTextEditor.calledOnce, true);
  });

  test('Processes file if active editor is opened on activation', async () => {
    advisorStubWindow.getActiveTextEditor = () =>
      ({
        document: {
          fileName: 'package.json',
          languageId: PJSON,
          getText: () => ``,
        },
      } as unknown as TextEditor);

    advisorStubWorkspace.onDidChangeTextDocument = sinon.fake();
    advisorStubWindow.onDidChangeActiveTextEditor = sinon.fake();

    const getActiveTextEditorSpy = sinon.spy(advisorStubWindow, 'getActiveTextEditor');
    const processFileSpy = sinon.spy(advisorService, 'processScores');

    await advisorService.activate();

    strictEqual(getActiveTextEditorSpy.called, true);
    strictEqual(processFileSpy.calledOnce, true);
  });

  test("Doesn't process if file is language not supported", async () => {
    const document = {
      fileName: 'C:\\git\\project\\test.java',
      languageId: 'java',
    } as TextDocument;
    const ev: TextDocumentChangeEvent = {
      document,
      contentChanges: [],
      reason: undefined,
    };

    const processFileSpy = sinon.spy(advisorService, 'processScores');
    await advisorService.handleEditorEvent(ev.document);

    strictEqual(processFileSpy.called, false);
  });
});
