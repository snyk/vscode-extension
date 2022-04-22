import { Marker } from '@snyk/code-client';
import { deepStrictEqual, strictEqual } from 'assert';
import path from 'path';
import sinon from 'sinon';
import { IVSCodeLanguages } from '../../../../snyk/common/vscode/languages';
import { IVSCodeWorkspace } from '../../../../snyk/common/vscode/workspace';
import {
  createIssueRange,
  createIssueRelatedInformation,
  getAbsoluteMarkerFilePath,
} from '../../../../snyk/snykCode/utils/analysisUtils';
import { IssuePlacementPosition } from '../../../../snyk/snykCode/utils/issueUtils';
import { languagesMock } from '../../mocks/languages.mock';
import { uriAdapterMock } from '../../mocks/uri.mock';
import { workspaceFolder, workspaceMock } from '../../mocks/workspace.mock';

suite('Snyk Code Analysis Utils', () => {
  const createRangeMock = sinon.mock();
  let languages: IVSCodeLanguages;
  let workspace: IVSCodeWorkspace;

  setup(() => {
    languages = {
      createRange: createRangeMock,
    } as unknown as IVSCodeLanguages;
    workspace = {} as IVSCodeWorkspace;
  });

  teardown(() => createRangeMock.reset());

  test('Create issue range copes with non-negative values', () => {
    const position: IssuePlacementPosition = {
      cols: {
        start: 1,
        end: 1,
      },
      rows: {
        start: 1,
        end: 1,
      },
    };

    createIssueRange(position, languages);

    sinon.assert.calledOnceWithExactly(createRangeMock, 1, 1, 1, 1);
  });

  test('Create issue range copes with negative values', () => {
    const position: IssuePlacementPosition = {
      cols: {
        start: -1,
        end: -1,
      },
      rows: {
        start: -1,
        end: -1,
      },
    };

    createIssueRange(position, languages);

    sinon.assert.calledOnceWithExactly(createRangeMock, 0, 0, 0, 0);
  });

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

  test('Creates correct related information for inter-file issues', () => {
    const file1Uri = 'file1.js';
    const file2Uri = 'file2.js';

    const markers: Marker[] = [
      {
        msg: [0, 16],
        pos: [
          {
            file: file1Uri,
            rows: [1, 1],
            cols: [1, 1],
          },
          {
            file: file2Uri,
            rows: [2, 2],
            cols: [10, 10],
          },
        ],
      },
    ];

    const message =
      'Unsanitized input from data from a remote resource flows into bypassSecurityTrustHtml, where it is used to render an HTML page returned to the user. This may result in a Cross-Site Scripting attack (XSS).';

    const information = createIssueRelatedInformation(
      markers,
      file2Uri,
      message,
      languagesMock,
      workspaceMock,
      uriAdapterMock,
    );

    deepStrictEqual(information, [
      {
        message: 'Unsanitized input',
        location: {
          uri: { path: path.join(workspaceFolder, file1Uri) },
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
        },
      },
      {
        message: 'Unsanitized input',
        location: {
          uri: { path: path.join(workspaceFolder, file2Uri) },
          range: { start: { line: 1, character: 9 }, end: { line: 1, character: 10 } },
        },
      },
    ]);
  });
});
