import { Marker } from '@snyk/code-client';
import { strictEqual, throws } from 'assert';
import * as os from 'os';
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
