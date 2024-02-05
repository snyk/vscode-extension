import he from 'he';
import { ExampleCommitFix } from '../../common/languageServer/types';

export const encodeExampleCommitFixes = (exampleCommitFixes: ExampleCommitFix[]): ExampleCommitFix[] => {
  return exampleCommitFixes.map(example => {
    return {
      ...example,
      lines: example.lines.map(commitLine => {
        if (!commitLine.isExampleLineEncoded) {
          return {
            ...commitLine,
            line: he.encode(commitLine.line),
            isExampleLineEncoded: true,
          };
        }

        return commitLine;
      }),
    };
  });
};
