export type TextBlockKind =
  | "paragraph"
  | "heading"
  | "list-item"
  | "table-cell"
  | "plain-text"
  | "spreadsheet-cell"
  | "textbox";

export type SegmentedTextBlock = {
  prefixText: string;
  segmentTexts: string[];
  separatorTexts: string[];
  suffixText: string;
};

const UNSPLITTABLE_BLOCK_KINDS = new Set<TextBlockKind>([
  "heading",
  "list-item",
  "table-cell",
  "spreadsheet-cell",
  "textbox",
]);

const ABBREVIATIONS = new Set(
  [
    "mr.",
    "mrs.",
    "ms.",
    "dr.",
    "prof.",
    "sr.",
    "jr.",
    "st.",
    "mt.",
    "vs.",
    "etc.",
    "e.g.",
    "i.e.",
    "cf.",
    "fig.",
    "no.",
    "nos.",
    "inc.",
    "ltd.",
    "co.",
    "corp.",
    "dept.",
    "est.",
    "a.m.",
    "p.m.",
  ].map((entry) => entry.toLowerCase()),
);

const SENTENCE_END_PUNCTUATION = new Set([".", "?", "!", ";", ":"]);
const LOOKAHEAD_WRAPPERS = new Set(['"', "'", "(", "[", "{", "“", "”", "‘", "’"]);
const TRAILING_PUNCTUATION = new Set(['"', "'", ")", "]", "}", "”", "’"]);

export function segmentTextBlock(
  text: string,
  blockKind: TextBlockKind,
): SegmentedTextBlock {
  const normalizedText = text.replace(/\r\n?/g, "\n");

  if (normalizedText.trim().length === 0) {
    return {
      prefixText: normalizedText,
      segmentTexts: [],
      separatorTexts: [],
      suffixText: "",
    };
  }

  if (UNSPLITTABLE_BLOCK_KINDS.has(blockKind)) {
    return createSingleSegmentBlock(normalizedText);
  }

  return splitSentenceSegments(normalizedText);
}

export function rebuildSegmentedText(
  segmentedText: SegmentedTextBlock,
  nextSegmentTexts: string[],
) {
  if (segmentedText.segmentTexts.length === 0) {
    return segmentedText.prefixText;
  }

  let nextText = segmentedText.prefixText;

  segmentedText.segmentTexts.forEach((segmentText, index) => {
    nextText += nextSegmentTexts[index] ?? segmentText;
    nextText += segmentedText.separatorTexts[index] ?? "";
  });

  nextText += segmentedText.suffixText;
  return nextText;
}

function createSingleSegmentBlock(text: string): SegmentedTextBlock {
  const prefixMatch = text.match(/^\s*/u)?.[0] ?? "";
  const suffixMatch = text.match(/\s*$/u)?.[0] ?? "";
  const content = text.slice(prefixMatch.length, text.length - suffixMatch.length);

  return {
    prefixText: prefixMatch,
    segmentTexts: content ? [content] : [],
    separatorTexts: [],
    suffixText: suffixMatch,
  };
}

function splitSentenceSegments(text: string): SegmentedTextBlock {
  const prefixMatch = text.match(/^\s*/u)?.[0] ?? "";
  const suffixMatch = text.match(/\s*$/u)?.[0] ?? "";
  const content = text.slice(prefixMatch.length, text.length - suffixMatch.length);

  if (content.trim().length === 0) {
    return {
      prefixText: prefixMatch,
      segmentTexts: [],
      separatorTexts: [],
      suffixText: suffixMatch,
    };
  }

  const segmentTexts: string[] = [];
  const separatorTexts: string[] = [];
  let cursor = 0;

  for (let index = 0; index < content.length; index += 1) {
    if (!SENTENCE_END_PUNCTUATION.has(content[index] ?? "")) {
      continue;
    }

    const boundaryEnd = getSentenceBoundaryEnd(content, index);
    if (boundaryEnd === null) {
      continue;
    }

    const separatorStart = boundaryEnd + 1;
    let nextSegmentStart = separatorStart;
    while (nextSegmentStart < content.length && /\s/u.test(content[nextSegmentStart] ?? "")) {
      nextSegmentStart += 1;
    }

    const segmentText = content.slice(cursor, separatorStart).trim();
    if (segmentText.length > 0) {
      segmentTexts.push(segmentText);
      separatorTexts.push(content.slice(separatorStart, nextSegmentStart));
      cursor = nextSegmentStart;
    }

    index = boundaryEnd;
  }

  const remainder = content.slice(cursor).trim();
  if (remainder.length > 0) {
    segmentTexts.push(remainder);
  } else if (separatorTexts.length > segmentTexts.length) {
    separatorTexts.pop();
  }

  return {
    prefixText: prefixMatch,
    segmentTexts: segmentTexts.length > 0 ? segmentTexts : [content],
    separatorTexts: separatorTexts.slice(0, Math.max(segmentTexts.length - 1, 0)),
    suffixText: suffixMatch,
  };
}

function getSentenceBoundaryEnd(text: string, index: number) {
  const character = text[index] ?? "";
  if (!SENTENCE_END_PUNCTUATION.has(character)) {
    return null;
  }

  if (character === "." && isDecimalPoint(text, index)) {
    return null;
  }

  if (character === "." && isAbbreviation(text, index)) {
    return null;
  }

  if (character === "." && isInternalDomainSeparator(text, index)) {
    return null;
  }

  let boundaryEnd = index;
  while (boundaryEnd + 1 < text.length && TRAILING_PUNCTUATION.has(text[boundaryEnd + 1] ?? "")) {
    boundaryEnd += 1;
  }

  const nextSentenceIndex = findNextSentenceStart(text, boundaryEnd + 1);
  if (nextSentenceIndex === null) {
    return boundaryEnd;
  }

  const nextCharacter = text[nextSentenceIndex] ?? "";
  if (!isLikelySentenceStart(nextCharacter)) {
    return null;
  }

  return boundaryEnd;
}

function isDecimalPoint(text: string, index: number) {
  return /\d/u.test(text[index - 1] ?? "") && /\d/u.test(text[index + 1] ?? "");
}

function isInternalDomainSeparator(text: string, index: number) {
  return /[A-Za-z0-9-]/u.test(text[index - 1] ?? "") && /[A-Za-z0-9-]/u.test(text[index + 1] ?? "");
}

function isAbbreviation(text: string, index: number) {
  if (text[index] !== ".") {
    return false;
  }

  let tokenStart = index;
  while (tokenStart > 0 && /[A-Za-z.]/u.test(text[tokenStart - 1] ?? "")) {
    tokenStart -= 1;
  }

  const token = text.slice(tokenStart, index + 1).toLowerCase();
  if (ABBREVIATIONS.has(token)) {
    return true;
  }

  return /^(?:[A-Za-z]\.){2,}$/u.test(token);
}

function findNextSentenceStart(text: string, startIndex: number) {
  let index = startIndex;

  while (index < text.length && /\s/u.test(text[index] ?? "")) {
    index += 1;
  }

  while (index < text.length && LOOKAHEAD_WRAPPERS.has(text[index] ?? "")) {
    index += 1;
  }

  return index < text.length ? index : null;
}

function isLikelySentenceStart(character: string) {
  return /[A-Z0-9]/u.test(character);
}
