import { strictEqual } from 'assert';
import { deleteDelimitedBlock, upsertDelimitedBlock } from '../../../../snyk/cli/mcp/text';

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

suite('mcp deleteDelimitedBlock', () => {
  const START = '###BEGIN SNYK GLOBAL RULE###';
  const END = '###END SNYK GLOBAL RULE###';

  test('returns empty string when file only contains delimited block', () => {
    const src = `${START}\nCONTENT\n${END}\n`;
    const result = deleteDelimitedBlock(src, START, END);
    strictEqual(result, '');
  });

  test('removes delimited block and preserves surrounding content', () => {
    const src = ['top line', START, 'CONTENT', END, 'bottom line', ''].join('\n');
    const result = deleteDelimitedBlock(src, START, END);
    strictEqual(result, 'top line\n\nbottom line\n');
  });

  test('preserves content before delimited block when no content after', () => {
    const src = ['top line', 'more content', START, 'CONTENT', END, ''].join('\n');
    const result = deleteDelimitedBlock(src, START, END);
    strictEqual(result, 'top line\nmore content\n');
  });

  test('preserves content after delimited block when no content before', () => {
    const src = [START, 'CONTENT', END, 'bottom line', 'more content', ''].join('\n');
    const result = deleteDelimitedBlock(src, START, END);
    strictEqual(result, 'bottom line\nmore content\n');
  });

  test('returns original content unchanged when markers not found', () => {
    const src = 'hello\nworld\n';
    const result = deleteDelimitedBlock(src, START, END);
    strictEqual(result, src);
  });

  test('normalizes CRLF and removes block correctly', () => {
    const src = `top\r\n${START}\r\nCONTENT\r\n${END}\r\nbottom\r\n`;
    const result = deleteDelimitedBlock(src, START, END);
    strictEqual(result, 'top\n\nbottom\n');
  });

  test('returns original content when only start marker is present', () => {
    const src = `top\n${START}\nbottom\n`;
    const result = deleteDelimitedBlock(src, START, END);
    strictEqual(result, src);
  });

  test('returns original content when only end marker is present', () => {
    const src = `top\n${END}\nbottom\n`;
    const result = deleteDelimitedBlock(src, START, END);
    strictEqual(result, src);
  });

  test('returns original content when end marker comes before start marker', () => {
    const src = `top\n${END}\nmiddle\n${START}\nbottom\n`;
    const result = deleteDelimitedBlock(src, START, END);
    strictEqual(result, src);
  });
});
