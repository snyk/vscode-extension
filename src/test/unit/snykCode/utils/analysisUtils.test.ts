import { strictEqual } from 'assert';
import path from 'path';
import sinon from 'sinon';
import { IVSCodeWorkspace } from '../../../../snyk/common/vscode/workspace';
import { getAbsoluteMarkerFilePath } from '../../../../snyk/snykCode/utils/analysisUtils';

suite('Snyk Code Analysis Utils', () => {
  const createRangeMock = sinon.mock();
  let workspace: IVSCodeWorkspace;

  setup(() => {
    workspace = {} as IVSCodeWorkspace;
  });

  teardown(() => createRangeMock.reset());

  test('Returns correct absolute path if no marker file path provided', () => {
    // arrange
    const suggestionFilePath = '/Users/snyk/goof/test.js';
    const markerFilePath = '';

    // act
    const absoluteFilePath = getAbsoluteMarkerFilePath(workspace, markerFilePath, suggestionFilePath);

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
    const absoluteFilePath = getAbsoluteMarkerFilePath(workspace, markerFilePath, suggestionFilePath);

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
    const absoluteFilePath = getAbsoluteMarkerFilePath(workspace, relativeMarkerFilePath, suggestionFilePath);

    // assert
    strictEqual(absoluteFilePath, path.resolve(workspaceFolder, relativeMarkerFilePath));
  });
});
