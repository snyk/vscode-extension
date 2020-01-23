import * as assert from "assert";
import * as path from "path";
import {
  readFile,
  createFileHash,
  createFilesHashesBundle
} from "../../deepcode/utils/filesUtils";

suite("Hashing Files Tests", () => {
  // Defines a Mocha unit test
  const mockedFilesDirPath = __dirname.replace("out/test", "src/test");
  const mockedFilesFilters = {
    extensions: [".java", ".html", ".js", ".jsx", ".ts", ".tsx", ".vue", ".py"],
    configFiles: [
      ".pmdrc.xml",
      ".ruleset.xml",
      "ruleset.xml",
      ".eslintrc.js",
      ".eslintrc.json",
      ".eslintrc.yml",
      "tslint.json",
      ".pylintrc",
      "pylintrc"
    ]
  };

  test("Creating hash of file", async () => {
    const filePath = path.join(mockedFilesDirPath, "../mocked_data/test.java");
    const fileUtf8Content = await readFile(filePath);
    const fileHash = createFileHash(fileUtf8Content);
    const expectedHash =
      "09f4ca64118f029e5a894305dfc329c930ebd2a258052de9e81f895b055ec929";
    assert.equal(expectedHash, fileHash);
  });

  test("Creating hash bundle of files", async () => {
    const folderPath = path.join(
      mockedFilesDirPath,
      "../mocked_data/sample_repository"
    );
    const hashesBundle = await createFilesHashesBundle(
      folderPath,
      mockedFilesFilters
    );
    const expectedBundle = {
      "/main.js":
        "3e2979852cc2e97f48f7e7973a8b0837eb73ed0485c868176bc3aa58c499f534",
      "/sub_folder/test2.js":
        "c8bc645260a7d1a0d1349a72150cb65fa005188142dca30d09c3cc67c7974923",
      "/utf8.js":
        "cc2b67993e547813db67f57c6b20bff83bf4ade64ea2c3fb468d927425502804"
    };

    assert.deepEqual(expectedBundle, hashesBundle);
  });
});
