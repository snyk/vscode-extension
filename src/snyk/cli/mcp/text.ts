export const RULE_START = '###BEGIN SNYK GLOBAL RULE###';
export const RULE_END = '###END SNYK GLOBAL RULE###';

/**
 * Replace or append a delimited block inside a file.
 * - If both markers exist: replace content between them (inclusive of markers is preserved by passing full `block`).
 * - If not found: append block with a separating newline if needed.
 */
export function upsertDelimitedBlock(source: string, start: string, end: string, fullBlockToInsert: string): string {
  // Normalize newlines to \n for regex ops
  const src = source.replace(/\r\n/g, '\n');

  const startIdx = src.indexOf(start);
  const endIdx = src.indexOf(end);

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    // Replace from start marker to end marker (inclusive)
    const before = src.slice(0, startIdx);
    const after = src.slice(endIdx + end.length);
    // Ensure single trailing newline around seams
    return `${trimTrailingNewlines(before)}\n${fullBlockToInsert.trim()}\n${trimLeadingNewlines(after)}`;
  }

  // No existing block: append, ensuring file ends with a newline first
  const prefix = src.length ? `${trimTrailingNewlines(src)}\n\n` : '';
  return `${prefix}${fullBlockToInsert.trim()}\n`;
}

function trimTrailingNewlines(s: string): string {
  return s.replace(/\s*$/g, '').replace(/\r?\n*$/g, '');
}
function trimLeadingNewlines(s: string): string {
  return s.replace(/^\r?\n*/g, '');
}
