//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//
import * as assert from "assert";
import * as vscode from "vscode";
import * as path from "path";
import * as nock from "nock";
//
import * as extension from "../../extension";
import Deepcode from "../../interfaces/DeepCodeInterfaces";

import http from "../../deepcode/http/requests";

// mocked data for tests
const testHost = "http://localhost:3000";
const testHostPrefix = "/publicapi";
const testToken = "TEST_TOKEN";
const testBundleId = "testBundleId";
const mockedTestFilesDirPath = __dirname.replace("out/test", "src/test");
const mockedFolderPath = vscode.Uri.parse(
  "scheme:" + path.join(mockedTestFilesDirPath, "/../mocked_data"),
  true
).fsPath;

// mocked server
const mockedServer = nock(`${testHost}${testHostPrefix}`, {
  reqheaders: {
    "Session-Token": testToken
  }
});
// mocked server responses
const mockedServerBundleWithMissingFiles = {
  statusCode: 200,
  bundleId: testBundleId,
  missingFiles: ["/sample_repository/sub_folder/test2.js"]
};
const mockedCheckedBundle = { statusCode: 200, bundleId: testBundleId };
const mockedFilesFiltersResponse = { extensions: [".js"], configFiles: [] };
const mockedAnalysisResults = {
  status: "DONE",
  progress: 1.0,
  analysisResults: {
    files: { "/main.js": { "0": [{ rows: [1, 2], cols: [3, 4] }] } },
    suggestions: {
      "0": { message: "some message", severity: 1 }
    }
  },
  analysisURL: "test_analysis_url"
};
// mocked endpoints
mockedServer.get('/session').query(true).reply(200, { type: "private" });
mockedServer.get('/filters').reply(200, mockedFilesFiltersResponse);
mockedServer
  .post("/bundle")
  .matchHeader("Content-Type", "application/json")
  .reply(200, mockedServerBundleWithMissingFiles);
mockedServer
  .post(`/file/${testBundleId}`)
  .matchHeader("Content-Type", "application/json;charset=utf-8")
  .reply(200);
mockedServer.get(`/bundle/${testBundleId}`).reply(200, mockedCheckedBundle);
mockedServer.get(`/analysis/${testBundleId}`).reply(200, mockedAnalysisResults);

// pre test configuring extension
const preTestConfigureExtension = () => {
  // pre-test extension changes before performing tests
  const testExtension = extension.getExtension();

  // set test token and backend host
  testExtension.staticUploadApproved = true;
  testExtension.staticToken = testToken;
  testExtension.staticBaseURL = testHost;
  
  // set workspace path for tests
  testExtension.workspacesPaths = [mockedFolderPath];
  
  return testExtension;
};

const uri = vscode.Uri.file(
  path.join(mockedTestFilesDirPath, "../mocked_data/sample_repository", "main.js"),
);

const testIgnoreComment = '  // deepcode ignore UseStrictEquality: <please specify a reason of ignoring this>\n';
const testFilesList = [
  '/../mocked_data/sample_repository/utf8.js',
  '/../mocked_data/sample_repository/main.js',
  '/../mocked_data/sample_repository/sub_folder/test2.js',
  '/../mocked_data/test.java',
];

suite("Deepcode Extension Tests", () => {
  let testExtension: Deepcode.ExtensionInterface;
  test("Pre-test configuring", () => {
    testExtension = preTestConfigureExtension();
    assert.equal(testExtension.token, testToken);
    assert.equal(testExtension.baseURL, testHost);
    assert.equal(
      testExtension.workspacesPaths[0],
      path.join(mockedTestFilesDirPath, "../mocked_data")
    );
  });

  test("Fetching files filters list", async () => {
    await testExtension.createFilesFilterList();
    assert.deepEqual(
      testExtension.serverFilesFilterList,
      mockedFilesFiltersResponse
    );
  });

  test('Insert ignore comment line', async () => {
    const document = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(document, 1, false);
    return editor.edit(textEditor => {
      textEditor.insert(new vscode.Position(18, 0), testIgnoreComment);
    }).then(inserted => {
      assert.equal(`${document.lineAt(18).text}\n`, testIgnoreComment);
      // TODO: find a way to undo this change
      // TODO: check actual analysis results with ignored line
    });
  });

  test('Send files list to analyse', async () => {
    try {
      await http.analyse(testHost, testToken, mockedTestFilesDirPath, testFilesList);
      assert.equal(true, true);
    } catch(error) {
      console.log(error);
    }
  });
});