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

// mocked data for tests
const testHost = "http://localhost:3000";
const testHostPrefix = "/publicapi";
const testToken = "TEST_TOKEN";
const testBundleId = "testBundleId";
const mockedTestFilesDirPath = __dirname.replace("out/test", "src/test");
const mockedFolderPath = vscode.Uri.parse(
  "scheme:" + path.join(mockedTestFilesDirPath, "../mocked_data"),
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
mockedServer.get("/session").reply(200, { type: "private" });
mockedServer.get("/filters").reply(200, mockedFilesFiltersResponse);
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
  
  // set test token
  testExtension.token = testToken;
  
  // set test backend host
  testExtension.config.changeDeepCodeUrl(testHost);
  
  // init HTTP module
  testExtension.initAPI({
    baseURL: testHost,
    useDebug: true,
  });

  // mock login and upload confirm to always true
  testExtension.checkUploadConfirm = () => true;
  testExtension.login = async () => true;
  
  // set workspace path for tests
  testExtension.workspacesPaths = [mockedFolderPath];
  
  return testExtension;
};

suite("Deepcode Extension Tests", () => {
  let testExtension: Deepcode.ExtensionInterface;
  test("Pre-test configuring", () => {
    testExtension = preTestConfigureExtension();
    assert.equal(testExtension.token, testToken);
    assert.equal(testExtension.config.deepcodeUrl, testHost);
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
});
