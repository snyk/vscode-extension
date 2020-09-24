//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//
import * as assert from "assert";
import * as vscode from "vscode";
import * as nodePath from 'path';
//
import * as extension from "../../extension";
import { ExtensionInterface } from "../../interfaces/DeepCodeInterfaces";

const testToken = '23';
const mockedTestFilesDirPath = __dirname.replace("out/test", "src/test");
const mockedFolderPath = vscode.Uri.parse('scheme:' + nodePath.join(mockedTestFilesDirPath, '/../mocked_data'), true)
  .fsPath;

// pre test configuring extension
const preTestConfigureExtension = () => {
  // pre-test extension changes before performing tests
  const testExtension = extension.getExtension();

  // set test token and backend host
  testExtension.staticUploadApproved = true;
  testExtension.staticToken = testToken;

  // // set workspace path for tests
  // testExtension.workspacesPaths = [mockedFolderPath];

  return testExtension;
};

const uri = vscode.Uri.file(nodePath.join(mockedTestFilesDirPath, '../mocked_data/sample_repository', 'main.js'));

const testIgnoreComment = '  // deepcode ignore UseStrictEquality: <please specify a reason of ignoring this>\n';

suite("Deepcode Extension Tests", () => {
  let testExtension: ExtensionInterface;
  test('Pre-test configuring', () => {
    testExtension = preTestConfigureExtension();
    assert.equal(testExtension.token, testToken);
    assert.equal(testExtension.baseURL, 'sdfs');
    // assert.equal(
    //   testExtension.workspacesPaths[0],
    //   path.join(mockedTestFilesDirPath, "../mocked_data")
    // );
  });

  test('Insert ignore comment line', async () => {
    const document = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(document, 1, false);
    return editor
      .edit(textEditor => {
        textEditor.insert(new vscode.Position(18, 0), testIgnoreComment);
      })
      .then(inserted => {
        assert.equal(`${document.lineAt(18).text}\n`, testIgnoreComment);
        assert.equal(inserted, testIgnoreComment);
        // TODO: find a way to undo this change
        // TODO: check actual analysis results with ignored line
      });
  });

  // test('Send files list to analyse', async () => {
  //   try {
  //     await testExtension.analyse({
  //       baseURL: testHost,
  //       sessionToken: testToken,
  //       baseDir: mockedTestFilesDirPath,
  //       files: testFilesList,
  //       removedFiles: []
  //     });
  //     assert.equal(true, true);
  //   } catch(error) {
  //     console.log(error);
  //   }
  // });
});
