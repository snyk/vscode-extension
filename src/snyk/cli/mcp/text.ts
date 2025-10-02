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

/**
 * Remove a delimited block from content completely (including markers).
 * - If both markers exist: removes everything between and including the markers
 * - If markers not found: returns the original content unchanged
 * - Returns empty string if the file only contained the delimited block
 */
export function deleteDelimitedBlock(source: string, start: string, end: string): string {
  // Normalize newlines to \n for regex ops
  const src = source.replace(/\r\n/g, '\n');

  const startIdx = src.indexOf(start);
  const endIdx = src.indexOf(end);

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const before = src.slice(0, startIdx).trimEnd();
    const after = src.slice(endIdx + end.length).trimStart();

    if (before === '' && after === '') {
      // File only contained the delimited block
      return '';
    }

    // Join before and after, preserving content outside the delimited block
    if (before && after) {
      // Ensure after ends with exactly one newline if it has content
      const afterTrimmed = after.trimEnd();
      return `${before}\n\n${afterTrimmed}\n`;
    }
    return `${before}${after}`.trim() + (before || after ? '\n' : '');
  }

  // No block found, return original
  return src;
}

function trimTrailingNewlines(s: string): string {
  return s.replace(/\s*$/g, '').replace(/\r?\n*$/g, '');
}
function trimLeadingNewlines(s: string): string {
  return s.replace(/^\r?\n*/g, '');
}
