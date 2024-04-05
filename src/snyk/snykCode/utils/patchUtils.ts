import { IVSCodeLanguages } from '../../common/vscode/languages';
import { DecorationOptions } from '../../common/vscode/types';

// Supports Unified Diff Format
export function generateDecorationOptions(patch: string, languages: IVSCodeLanguages): DecorationOptions[] {
  const codeLines = patch.split('\n');

  // the first two lines are the file names
  codeLines.shift();
  codeLines.shift();

  const decorationOptions: DecorationOptions[] = [];
  let currentLine = -1;

  for (const line of codeLines) {
    if (line.startsWith('@@ ')) {
      // format is -original, +new
      // @@ -start,count +start,count @@
      // counts are considered optional
      // we only care about the start line for the new file
      const [, , added] = line.split(' ');
      const [startLineValue] = added.split(',');

      // unified diff line numbers start from 1 not 0
      // vscode.Range starts from 0 not 1
      currentLine = parseInt(startLineValue) - 1;
    } else {
      if (line.startsWith('+')) {
        const range = languages.createRange(currentLine, 0, currentLine, line.length - 1);

        decorationOptions.push({ range });
        currentLine++;
      } else if (line.startsWith('-')) {
        continue;
      } else {
        currentLine++;
      }
    }
  }

  return decorationOptions;
}
