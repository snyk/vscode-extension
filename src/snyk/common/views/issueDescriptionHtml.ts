const SNYK_LEARN_CONTAINER_CLASS = 'sn-learn';
const SNYK_LEARN_HOST = 'learn.snyk.io';

type ElementRange = {
  start: number;
  end: number;
};

function getAttribute(tag: string, attribute: string): string | undefined {
  const match = tag.match(new RegExp(`\\b${attribute}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return match?.[1] ?? match?.[2] ?? match?.[3];
}

function findElementEnd(html: string, openingTagEnd: number, tagName: string): number | undefined {
  const tagRegex = new RegExp(`<\\/?${tagName}\\b[^>]*>`, 'gi');
  tagRegex.lastIndex = openingTagEnd;
  let depth = 1;
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(html))) {
    if (/^<\s*\//.test(match[0])) {
      depth--;
      if (depth === 0) return tagRegex.lastIndex;
    } else if (!/\/\s*>$/.test(match[0])) {
      depth++;
    }
  }

  return undefined;
}

function findElements(html: string, predicate: (tagName: string, openingTag: string) => boolean): ElementRange[] {
  const ranges: ElementRange[] = [];
  const openingTagRegex = /<([a-z][\w:-]*)\b[^>]*>/gi;
  let match: RegExpExecArray | null;

  while ((match = openingTagRegex.exec(html))) {
    const [openingTag, tagName] = match;
    if (!predicate(tagName, openingTag)) continue;

    const end = findElementEnd(html, openingTagRegex.lastIndex, tagName);
    if (end === undefined) continue;

    ranges.push({ start: match.index, end });
    openingTagRegex.lastIndex = end;
  }

  return ranges;
}

function removeRanges(html: string, ranges: ElementRange[]): string {
  return ranges.reduceRight((result, range) => result.slice(0, range.start) + result.slice(range.end), html);
}

export function isSnykLearnUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false;

  try {
    return new URL(value).hostname.toLowerCase() === SNYK_LEARN_HOST;
  } catch {
    return false;
  }
}

export function removeSnykLearnContent(html: string): string {
  const learnContainers = findElements(html, (_tagName, openingTag) =>
    (getAttribute(openingTag, 'class')?.split(/\s+/) ?? []).includes(SNYK_LEARN_CONTAINER_CLASS),
  );
  const withoutLearnContainers = removeRanges(html, learnContainers);
  const standaloneLearnLinks = findElements(
    withoutLearnContainers,
    (tagName, openingTag) => tagName.toLowerCase() === 'a' && isSnykLearnUrl(getAttribute(openingTag, 'href')),
  );

  return removeRanges(withoutLearnContainers, standaloneLearnLinks);
}
