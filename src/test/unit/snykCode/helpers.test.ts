import { strictEqual } from 'assert';
import { ExampleCommitFix } from '../../../snyk/common/languageServer/types';
import { encodeExampleCommitFixes } from '../../../snyk/snykCode/utils/htmlEncoder';

const exampleInput: ExampleCommitFix[] = [
  {
    commitURL:
      'https://github.com/hiddentao/fast-levenshtein/commit/8d67bde78c9e75b5e253b0e84d0cbf227ffb98f9?diff=split#diff-a58852f173bee316460a26934b8a3c4d79b1acb88af655346ae74adce78113f7L-1',
    lines: [
      {
        line: '\t\t\t\t\tuploadUserPicture(req.user.uid, req.files.userPhoto.name, req.files.userPhoto.path, res);\n',
        lineNumber: 101,
        lineChange: 'removed',
      },
      {
        line: "  files.map(file => path.join(...[dashboardAppPath].concat(file.fileName.split('/'))))\n",
        lineNumber: 145,
        lineChange: 'added',
      },
    ],
  },
  {
    commitURL:
      'https://github.com/guzzle/guzzle/commit/3d499a1b7ce589c3ef39d78bb1730d83d8a89c79?diff=split#diff-dea67d130560147fa1eeb821ab305ce5c0d44c5a3a0b16f3f11b4cb48008dcbaL-1',
    lines: [
      {
        line: "\tvar template = routes['/' + req.params.path] || routes['/'];\n",
        lineNumber: 43,
        lineChange: 'added',
      },
      {
        line: "\t\t\tconsole.log('Info: Attempting upload to: '+ uploadPath);\n",
        lineNumber: 130,
        lineChange: 'none',
      },
    ],
  },
  {
    commitURL: 'https://github.com/example/security-fix/commit/1234567890abcdef?diff=split#diff-securityL-1',
    lines: [
      {
        line: `'that.responses = eval('('+ request.body + ')');\n'`, // Potential security vulnerability: eval with user input
        lineNumber: 50,
        lineChange: 'removed',
      },
    ],
  },
];

suite('encodeExampleCommitFixes', () => {
  test('should encode lines', () => {
    // The `he` library encodes characters into their hexadecimal numeric character reference.
    const encodedResults = encodeExampleCommitFixes(exampleInput);

    strictEqual(
      encodedResults[0].lines[0].line,
      '&#x9;&#x9;&#x9;&#x9;&#x9;uploadUserPicture(req.user.uid, req.files.userPhoto.name, req.files.userPhoto.path, res);\n',
    );

    strictEqual(
      encodedResults[0].lines[1].line,
      '  files.map(file =&#x3E; path.join(...[dashboardAppPath].concat(file.fileName.split(&#x27;/&#x27;))))\n',
    );

    strictEqual(
      encodedResults[2].lines[0].line,
      '&#x27;that.responses = eval(&#x27;(&#x27;+ request.body + &#x27;)&#x27;);\n' + '&#x27;',
    );
  });
});
