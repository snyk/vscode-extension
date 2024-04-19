import assert from 'assert';
import * as patchUtils from '../../../../snyk/snykCode/utils/patchUtils';
import { IVSCodeLanguages } from '../../../../snyk/common/vscode/languages';

suite('generateDecorationOptions', () => {
  let languages: IVSCodeLanguages;

  setup(() => {
    languages = {
      createRange: (startLine: number, startCharacter: number, endLine: number, endCharacter: number) => ({
        start: { line: startLine, character: startCharacter },
        end: { line: endLine, character: endCharacter },
      }),
    } as IVSCodeLanguages;
  });

  test('generates ranges for adding to empty files', () => {
    const patch = `--- /home/mike/boom
+++ /home/mike/boom-fixed
@@ -1 1,4 @@
+ def main():
+     print("hello world")
+
+ main()`;
    const result = patchUtils.generateDecorationOptions(patch, languages);
    assert.strictEqual(result.length, 4);

    assert.strictEqual(result[0].range.start.line, 0);
    assert.strictEqual(result[0].range.start.character, 0);
    assert.strictEqual(result[0].range.end.line, 0);
    assert.strictEqual(result[0].range.end.character, 12);

    assert.strictEqual(result[3].range.start.line, 3);
    assert.strictEqual(result[3].range.start.character, 0);
    assert.strictEqual(result[3].range.end.line, 3);
    assert.strictEqual(result[3].range.end.character, 7);
  });

  test('generates empty result for completely removing a file', () => {
    const patch = `--- /home/mike/boom
+++ /home/mike/boom-fixed
@@ -1,4 1 @@
- def main():
-     print("hello world")
-
- main()`;
    const result = patchUtils.generateDecorationOptions(patch, languages);
    assert.strictEqual(result.length, 0);
  });

  test('works with single hunks', () => {
    const patch = `-- /home/patch/goof
+++ /home/patch/goof-fixed
@@ -1 +15,8 @@
 var fileType = require('file-type');
 var AdmZip = require('adm-zip');
 var fs = require('fs');
+var RateLimit = require('express-rate-limit');
+var limiter = new RateLimit({
+  windowMs: parseInt(process.env.WINDOW_MS, 10),
+  max: parseInt(process.env.MAX_IP_REQUESTS, 10),
+  delayMs:parseInt(process.env.DELAY_MS, 10),
+  headers: true
+});
+app.user(limiter);

 // prototype-pollution
 var _ = require('lodash');`;

    const result = patchUtils.generateDecorationOptions(patch, languages);

    assert.strictEqual(result.length, 8);

    assert.strictEqual(result[0].range.start.line, 17);
    assert.strictEqual(result[0].range.start.character, 0);
    assert.strictEqual(result[0].range.end.line, 17);
    assert.strictEqual(result[0].range.end.character, 46);

    assert.strictEqual(result[7].range.start.line, 24);
    assert.strictEqual(result[7].range.start.character, 0);
    assert.strictEqual(result[7].range.end.line, 24);
    assert.strictEqual(result[7].range.end.character, 18);
  });

  test('works with multiple hunks', () => {
    const patch = `-- /home/patch/snek
+++ /home/patch/snek-fixed
@@ -1,2 +1,2 @@
 import math
 from my_module import do_some_work

 def generate_number() -> int:
-   return math.random() * 100
+   return math.random() * 20

 result = do_some_work()
 print(result)

@@ -25,1 +25,1 @@
-result *= generate_number()
+result += generate_number()
`;

    const result = patchUtils.generateDecorationOptions(patch, languages);

    assert.strictEqual(result.length, 2);

    assert.strictEqual(result[0].range.start.line, 4);
    assert.strictEqual(result[0].range.start.character, 0);
    assert.strictEqual(result[0].range.end.line, 4);
    assert.strictEqual(result[0].range.end.character, 28);

    assert.strictEqual(result[1].range.start.line, 24);
    assert.strictEqual(result[1].range.start.character, 0);
    assert.strictEqual(result[1].range.end.line, 24);
    assert.strictEqual(result[1].range.end.character, 27);
  });
});
