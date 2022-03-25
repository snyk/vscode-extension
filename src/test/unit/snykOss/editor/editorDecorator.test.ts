import assert from 'assert';
import sinon from 'sinon';
import { IVSCodeLanguages } from '../../../../snyk/common/vscode/languages';
import { IThemeColorAdapter } from '../../../../snyk/common/vscode/theme';
import { IVSCodeWindow } from '../../../../snyk/common/vscode/window';
import { EditorDecorator } from '../../../../snyk/snykOss/editor/editorDecorator';
import { ModuleVulnerabilityCount } from '../../../../snyk/snykOss/services/vulnerabilityCount/importedModule';

suite('OSS Editor Decorator', () => {
  let decorator: EditorDecorator;

  setup(() => {
    const window = {
      createTextEditorDecorationType: sinon.fake(),
    } as unknown as IVSCodeWindow;
    const languages = {
      createRange: (startLine: number, startCharacter: number, endLine: number, endCharacter: number) => ({
        start: { line: startLine, character: startCharacter },
        end: { line: endLine, character: endCharacter },
      }),
    } as IVSCodeLanguages;
    const themeAdapter = {
      create: sinon.fake(),
    } as IThemeColorAdapter;
    decorator = new EditorDecorator(window, languages, themeAdapter);
  });

  teardown(() => {
    sinon.restore();
  });

  test('Sets scanned decoration range correctly', () => {
    const fileName = 'test.js';
    const line = 1;
    const vulnCount: ModuleVulnerabilityCount = {
      fileName,
      line,
      hasCount: true,
      name: '@test/package',
      range: {
        start: {
          line: 1,
          column: 16,
        },
        end: {
          line: 1,
          column: 29,
        },
      },
    };

    decorator.setScannedDecoration(vulnCount, false);

    const decorations = decorator.fileDecorations.get(fileName);

    assert.deepStrictEqual(decorations?.[line].range, {
      start: { line: line - 1, character: Number.MAX_SAFE_INTEGER },
      end: { line: line - 1, character: Number.MAX_SAFE_INTEGER },
    });
  });
});
