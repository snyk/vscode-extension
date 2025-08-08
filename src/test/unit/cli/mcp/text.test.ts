import { strictEqual } from 'assert';
import { upsertDelimitedBlock } from '../../../../snyk/cli/mcp/text';

suite('mcp upsertDelimitedBlock', () => {
  const START = '###BEGIN SNYK GLOBAL RULE###';
  const END = '###END SNYK GLOBAL RULE###';

  test('inserts block into empty file', () => {
    const block = `${START}\nCONTENT\n${END}\n`;
    const result = upsertDelimitedBlock('', START, END, block);
    strictEqual(result, `${block.trim()}\n`);
  });

  test('appends block when markers not present, preserving one blank line separation', () => {
    const src = 'hello\nworld\n';
    const block = `${START}\nNEW\n${END}\n`;
    const result = upsertDelimitedBlock(src, START, END, block);
    strictEqual(result, `hello\nworld\n\n${block.trim()}\n`);
  });

  test('replaces existing block content in-place and keeps surrounding text', () => {
    const original = ['top line', START, 'OLD', END, 'bottom line', ''].join('\n');
    const block = `${START}\nNEW-CONTENT\n${END}\n`;
    const result = upsertDelimitedBlock(original, START, END, block);
    const expected = ['top line', block.trim(), 'bottom line', ''].join('\n');
    strictEqual(result, expected);
  });

  test('normalizes CRLF and replaces correctly', () => {
    const original = `top\r\n${START}\r\nOLD\r\n${END}\r\nbottom\r\n`;
    const block = `${START}\nNEW\n${END}\n`;
    const result = upsertDelimitedBlock(original, START, END, block);
    strictEqual(result, `top\n${block.trim()}\nbottom\n`);
  });
});
