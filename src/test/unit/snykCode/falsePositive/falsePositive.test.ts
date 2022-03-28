import { Marker } from '@snyk/code-client';
import { strictEqual, throws } from 'assert';
import * as os from 'os';
import path from 'path';
import sinon from 'sinon';
import { TextDocument } from '../../../../snyk/common/vscode/types';
import { IVSCodeWorkspace } from '../../../../snyk/common/vscode/workspace';
import { FalsePositive } from '../../../../snyk/snykCode/falsePositive/falsePositive';
import { completeFileSuggestionType } from '../../../../snyk/snykCode/interfaces';

suite('False Positive', () => {
  let workspace: IVSCodeWorkspace;

  setup(() => {
    workspace = {} as IVSCodeWorkspace;
  });

  teardown(() => {
    sinon.restore();
  });

  test('Instantiation throws when markers are empty', () => {
    throws(() => new FalsePositive(workspace, {} as completeFileSuggestionType));
  });

  test('Returns correct absolute path if no marker file path provided', () => {
    // arrange
    const suggestionFilePath = '/Users/snyk/goof/test.js';
    const markerFilePath = '';

    // act
    const absoluteFilePath = FalsePositive.getAbsoluteMarkerFilePath(workspace, markerFilePath, suggestionFilePath);

    // assert
    strictEqual(absoluteFilePath, suggestionFilePath);
  });

  test('Returns correct absolute path if in multi-folder workspace', () => {
    // arrange
    const suggestionFilePath = '/Users/snyk/goof/test.js';
    const markerFilePath = '/Users/snyk/goof/test2.js';
    workspace = {
      getWorkspaceFolders: () => ['/Users/snyk/goof1', '/Users/snyk/goof2'],
    } as unknown as IVSCodeWorkspace;

    // act
    const absoluteFilePath = FalsePositive.getAbsoluteMarkerFilePath(workspace, markerFilePath, suggestionFilePath);

    // assert
    strictEqual(absoluteFilePath, markerFilePath);
  });

  test('Returns correct absolute path if in single-folder workspace', () => {
    // arrange
    const suggestionFilePath = '/Users/snyk/goof/test.js';
    const relativeMarkerFilePath = 'test2.js';
    const workspaceFolder = '/Users/snyk/goof1';
    workspace = {
      getWorkspaceFolders: () => [workspaceFolder],
    } as unknown as IVSCodeWorkspace;

    // act
    const absoluteFilePath = FalsePositive.getAbsoluteMarkerFilePath(
      workspace,
      relativeMarkerFilePath,
      suggestionFilePath,
    );

    // assert
    strictEqual(absoluteFilePath, path.resolve(workspaceFolder, relativeMarkerFilePath));
  });

  test('Returns correct generated content', async () => {
    // arrange
    const filePath = os.platform() === 'win32' ? 'C:\\Users\\snyk\\goof\\test.js' : '/Users/snyk/goof/test.js';
    const marker = {
      msg: [0, 1],
      pos: [{ file: filePath, cols: [10, 20], rows: [1, 1] }],
    } as Marker;
    const suggestion = {
      cols: [10, 20],
      rows: [1, 1],
      markers: [marker],
    } as completeFileSuggestionType;

    const workspaceFolder = os.platform() === 'win32' ? 'C:\\Users\\snyk\\goof' : '/Users/snyk/goof';
    const text = 'console.log("Hello world");';
    const textDocument = {
      getText: () => text,
    } as unknown as TextDocument;

    workspace = {
      getWorkspaceFolders: () => [workspaceFolder],
      openFileTextDocument: () => Promise.resolve(textDocument),
    } as unknown as IVSCodeWorkspace;

    const fp = new FalsePositive(workspace, suggestion);

    // act
    const content = await fp.getGeneratedContent();

    // assert
    const expectedContent = `
/**
 * The following code will be uploaded to Snyk to be reviewed.
 * Make sure there are no sensitive information sent.
 */

/**
 * Code from ${filePath}
 */
${text}`.trimStart();

    strictEqual(content, expectedContent);
  });
});
