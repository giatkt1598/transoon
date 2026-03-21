import { DOMParser } from "@xmldom/xmldom";
import type { ExtractedSegment } from "./document-types";
import {
  rebuildSegmentedText,
  segmentTextBlock,
  type SegmentedTextBlock,
  type TextBlockKind,
} from "./segmentation/text-segmentation";

export type DocxPreviewBlock = {
  blockId: string;
  segmentIds: string[];
  kind: "paragraph" | "table-cell";
  prefixText?: string;
  separatorTexts?: string[];
  suffixText?: string;
};

export type DocxTextNodeBinding = {
  element: Element;
  originalText: string;
};

export type DocxContentBlockPlan = {
  entryName: string;
  blockType: TextBlockKind;
  textNodes: DocxTextNodeBinding[];
  segmentedText: SegmentedTextBlock;
  segmentIds: string[];
  segmentTexts: string[];
};

export type DocxEntryPlan = {
  document: Document;
  blocks: DocxContentBlockPlan[];
  segments: ExtractedSegment[];
  previewBlocks: DocxPreviewBlock[];
};

const parser = new DOMParser();
const DOCX_BODY_PATH = "word/document.xml";

export function buildDocxEntryPlan(entryName: string, xml: string): DocxEntryPlan {
  const document = parser.parseFromString(xml, "application/xml");
  const root = resolveEntryRoot(document);
  const blocks: DocxContentBlockPlan[] = [];
  const segments: ExtractedSegment[] = [];
  const previewBlocks: DocxPreviewBlock[] = [];
  let paragraphCounter = 0;
  let previewBlockCounter = 0;

  if (!root) {
    return {
      document,
      blocks,
      segments,
      previewBlocks,
    };
  }

  for (const childNode of Array.from(root.childNodes)) {
    if (childNode.nodeType !== childNode.ELEMENT_NODE) {
      continue;
    }

    const childElement = childNode as Element;
    const localName = getLocalName(childElement);

    if (localName === "p") {
      const paragraphBlock = buildParagraphBlock(
        childElement,
        entryName,
        paragraphCounter,
        false,
      );

      if (paragraphBlock) {
        blocks.push(paragraphBlock);
        segments.push(
          ...paragraphBlock.segmentIds.map((segmentId, index) => ({
            id: segmentId,
            text: paragraphBlock.segmentTexts[index] ?? "",
          })),
        );
        paragraphCounter += 1;
      }

      if (entryName === DOCX_BODY_PATH && paragraphBlock) {
        previewBlocks.push({
          blockId: `docx-block-${previewBlockCounter}`,
          segmentIds: paragraphBlock.segmentIds,
          kind: "paragraph",
          prefixText: paragraphBlock.segmentedText.prefixText,
          separatorTexts: paragraphBlock.segmentedText.separatorTexts,
          suffixText: paragraphBlock.segmentedText.suffixText,
        });
        previewBlockCounter += 1;
      }

      continue;
    }

    if (localName === "tbl") {
      const tableBlocks = collectTableParagraphBlocks(
        childElement,
        entryName,
        paragraphCounter,
      );

      blocks.push(...tableBlocks);
      segments.push(
        ...tableBlocks.flatMap((block) =>
          block.segmentIds.map((segmentId, index) => ({
            id: segmentId,
            text: block.segmentTexts[index] ?? "",
          })),
        ),
      );
      paragraphCounter += tableBlocks.length;

      if (entryName === DOCX_BODY_PATH) {
        tableBlocks.forEach((block) => {
          previewBlocks.push({
            blockId: `docx-block-${previewBlockCounter}`,
            segmentIds: block.segmentIds,
            kind: "table-cell",
            prefixText: block.segmentedText.prefixText,
            separatorTexts: block.segmentedText.separatorTexts,
            suffixText: block.segmentedText.suffixText,
          });
          previewBlockCounter += 1;
        });
      }
    }
  }

  return {
    document,
    blocks,
    segments,
    previewBlocks,
  };
}

export function rebuildDocxBlockText(
  block: DocxContentBlockPlan,
  nextSegmentTexts: string[],
) {
  return rebuildSegmentedText(block.segmentedText, nextSegmentTexts);
}

export function applyDocxBlockText(block: DocxContentBlockPlan, nextText: string) {
  if (block.textNodes.length === 0) {
    return;
  }

  const nodeWeights = block.textNodes.map((entry) => entry.originalText.length);
  const distributedTexts = distributeTextAcrossNodes(nextText, nodeWeights);

  block.textNodes.forEach((binding, index) => {
    setWordTextNodeValue(binding.element, distributedTexts[index] ?? "");
  });
}

function resolveEntryRoot(document: Document) {
  const body = findFirstElementByLocalName(document, "body");
  if (body) {
    return body;
  }

  return document.documentElement;
}

function buildParagraphBlock(
  paragraph: Element,
  entryName: string,
  paragraphIndex: number,
  insideTable: boolean,
) {
  const textNodes = collectDescendantElementsByLocalName(paragraph, "t");
  const combinedText = textNodes.map((node) => node.textContent ?? "").join("");

  if (combinedText.trim().length === 0) {
    return null;
  }

  const blockType = determineParagraphBlockType(paragraph, insideTable);
  const segmentedText = segmentTextBlock(combinedText, blockType);
  if (segmentedText.segmentTexts.length === 0) {
    return null;
  }

  const segmentIds = segmentedText.segmentTexts.map(
    (_entry, segmentIndex) => `${entryName}#p${paragraphIndex}-s${segmentIndex}`,
  );

  return {
    entryName,
    blockType,
    textNodes: textNodes.map((node) => ({
      element: node,
      originalText: node.textContent ?? "",
    })),
    segmentedText,
    segmentIds,
    segmentTexts: segmentedText.segmentTexts,
  } satisfies DocxContentBlockPlan;
}

function collectTableParagraphBlocks(
  table: Element,
  entryName: string,
  startingParagraphIndex: number,
) {
  const paragraphs = collectDescendantElementsByLocalName(table, "p");
  const blocks: DocxContentBlockPlan[] = [];
  let paragraphIndex = startingParagraphIndex;

  paragraphs.forEach((paragraph) => {
    const block = buildParagraphBlock(paragraph, entryName, paragraphIndex, true);
    if (!block) {
      return;
    }

    blocks.push(block);
    paragraphIndex += 1;
  });

  return blocks;
}

function determineParagraphBlockType(
  paragraph: Element,
  insideTable: boolean,
): TextBlockKind {
  if (insideTable) {
    return "table-cell";
  }

  const paragraphProperties = findFirstDirectChildByLocalName(paragraph, "pPr");
  const styleElement = paragraphProperties
    ? findFirstDirectChildByLocalName(paragraphProperties, "pStyle")
    : null;
  const styleValue = styleElement ? getAttributeByLocalName(styleElement, "val") : "";
  const normalizedStyleValue = styleValue.toLowerCase();

  if (/^(heading[\s-]*\d*|title|subtitle)/u.test(normalizedStyleValue)) {
    return "heading";
  }

  if (
    paragraphProperties &&
    (findFirstDirectChildByLocalName(paragraphProperties, "numPr") ||
      /^(list|bullet)/u.test(normalizedStyleValue))
  ) {
    return "list-item";
  }

  return "paragraph";
}

function distributeTextAcrossNodes(text: string, weights: number[]) {
  const characters = Array.from(text);
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);

  if (weights.length === 0) {
    return [];
  }

  if (weights.length === 1 || totalWeight <= 0) {
    return [text, ...Array(Math.max(weights.length - 1, 0)).fill("")];
  }

  const parts: string[] = [];
  let consumedCharacters = 0;
  let consumedWeight = 0;

  weights.forEach((weight, index) => {
    if (index === weights.length - 1) {
      parts.push(characters.slice(consumedCharacters).join(""));
      return;
    }

    consumedWeight += weight;
    const nextCharacterCount = Math.round(
      (characters.length * consumedWeight) / totalWeight,
    );
    parts.push(characters.slice(consumedCharacters, nextCharacterCount).join(""));
    consumedCharacters = nextCharacterCount;
  });

  return parts;
}

function setWordTextNodeValue(node: Element, value: string) {
  node.textContent = value;

  if (value.length > 0) {
    node.setAttribute("xml:space", "preserve");
    return;
  }

  node.removeAttribute("xml:space");
}

function collectDescendantElementsByLocalName(root: Document | Element, localName: string) {
  const matches: Element[] = [];

  walkElements(root, (element) => {
    if (getLocalName(element) === localName) {
      matches.push(element);
    }
  });

  return matches;
}

function findFirstElementByLocalName(document: Document, localName: string) {
  return collectDescendantElementsByLocalName(document, localName)[0] ?? null;
}

function findFirstDirectChildByLocalName(element: Element, localName: string) {
  for (const childNode of Array.from(element.childNodes)) {
    if (childNode.nodeType !== childNode.ELEMENT_NODE) {
      continue;
    }

    const childElement = childNode as Element;
    if (getLocalName(childElement) === localName) {
      return childElement;
    }
  }

  return null;
}

function getAttributeByLocalName(element: Element, localName: string) {
  if (element.hasAttribute(localName)) {
    return element.getAttribute(localName) ?? "";
  }

  const namespacedAttribute = Array.from(element.attributes).find((attribute) =>
    attribute.name === localName || attribute.name.endsWith(`:${localName}`),
  );

  return namespacedAttribute?.value ?? "";
}

function walkElements(root: Document | Element, visitor: (element: Element) => void) {
  for (const childNode of Array.from(root.childNodes)) {
    if (childNode.nodeType !== childNode.ELEMENT_NODE) {
      continue;
    }

    const childElement = childNode as Element;
    visitor(childElement);
    walkElements(childElement, visitor);
  }
}

function getLocalName(element: Element) {
  return element.localName ?? element.nodeName.replace(/^.*:/u, "");
}
