import he from 'he';
import { ExampleCommitFix } from '../../common/languageServer/types';

export const encodeExampleCommitFixes = (exampleCommitFixes: ExampleCommitFix[]): ExampleCommitFix[] => {
  return exampleCommitFixes.map(exampleCommitFixes => {
    return {
      ...exampleCommitFixes,
      lines: exampleCommitFixes.lines.map(line => {
        return {
          ...line,
          line: he.encode(line.line),
        };
      }),
    };
  });
};
