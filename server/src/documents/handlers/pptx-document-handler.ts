import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import JSZip from "jszip";
import type {
  DocumentHandler,
  ExtractedDocument,
  ExtractedSegment,
} from "../document-types";

const SLIDE_PATH_PATTERN = /^ppt\/slides\/slide\d+\.xml$/;
const NOTES_SLIDE_PATH_PATTERN = /^ppt\/notesSlides\/notesSlide\d+\.xml$/;
const SLIDE_LAYOUT_PATH_PATTERN = /^ppt\/slideLayouts\/slideLayout\d+\.xml$/;
const SLIDE_MASTER_PATH_PATTERN = /^ppt\/slideMasters\/slideMaster\d+\.xml$/;
const COMMENT_PATH_PATTERN = /^ppt\/comments\/comment\d+\.xml$/;
const CHART_PATH_PATTERN = /^ppt\/charts\/chart\d+\.xml$/;
export const PPTX_REMOVE_SEGMENT_SENTINEL = "\u0000__TRANSOON_PPTX_REMOVE_SEGMENT__";

type PptxSegmentType =
  | "slide-paragraph"
  | "notes-paragraph"
  | "layout-paragraph"
  | "master-paragraph"
  | "chart-paragraph"
  | "comment-text";

type SegmentDescriptor = {
  id: string;
  entryName: string;
  entryType: PptxSegmentType;
  itemIndex: number;
  text: string;
  previewPriority: number;
};

type ParagraphConfig = {
  entryType: Exclude<PptxSegmentType, "comment-text">;
  pathPattern: RegExp;
};

type TextElementConfig = {
  entryType: Extract<PptxSegmentType, "comment-text">;
  pathPattern: RegExp;
  elementNames: string[];
};

const parser = new DOMParser();
const serializer = new XMLSerializer();

const DISPLAY_TEXT_ENTRY_TYPES: readonly PptxSegmentType[] = [
  "slide-paragraph",
  "notes-paragraph",
  "layout-paragraph",
  "master-paragraph",
  "chart-paragraph",
  "comment-text",
] as const;

const INTERNAL_REFERENCE_TOKENS_NOT_TRANSLATED = [
  "relationship ids",
  "placeholder types",
  "chart formulas",
  "theme/style tokens",
  "rich text multi-run paragraphs",
] as const;

const paragraphConfigs: ParagraphConfig[] = [
  { entryType: "slide-paragraph", pathPattern: SLIDE_PATH_PATTERN },
  { entryType: "notes-paragraph", pathPattern: NOTES_SLIDE_PATH_PATTERN },
  { entryType: "layout-paragraph", pathPattern: SLIDE_LAYOUT_PATH_PATTERN },
  { entryType: "master-paragraph", pathPattern: SLIDE_MASTER_PATH_PATTERN },
  { entryType: "chart-paragraph", pathPattern: CHART_PATH_PATTERN },
];

const textElementConfigs: TextElementConfig[] = [
  {
    entryType: "comment-text",
    pathPattern: COMMENT_PATH_PATTERN,
    elementNames: ["text"],
  },
];

export class PptxDocumentHandler implements DocumentHandler {
  readonly supportedExtensions = [".pptx"];

  async extract(fileName: string, buffer: Buffer): Promise<ExtractedDocument> {
    const zip = await JSZip.loadAsync(buffer);
    const entryNames = Object.values(zip.files)
      .filter((entry) => matchesAnyConfig(entry.name))
      .map((entry) => entry.name);

    const entryXmlMap = new Map<string, string>();
    const descriptors: SegmentDescriptor[] = [];

    for (const entryName of entryNames) {
      const xml = await zip.file(entryName)?.async("text");
      if (!xml) {
        continue;
      }

      entryXmlMap.set(entryName, xml);
      const document = parseXml(xml);

      collectParagraphDescriptors(document, entryName, descriptors);
      collectTextElementDescriptors(document, entryName, descriptors);
    }

    return {
      documentType: "pptx",
      fileName,
      segments: descriptors.map((descriptor) => ({
        id: descriptor.id,
        text: descriptor.text,
        previewPriority: descriptor.previewPriority,
      })),
      replaceSegments: async (nextSegments: string[]) => {
        const replacementLookup = new Map<string, string>();

        descriptors.forEach((descriptor, index) => {
          replacementLookup.set(
            buildDescriptorKey(descriptor),
            nextSegments[index] ?? descriptor.text,
          );
        });

        for (const [entryName, xml] of entryXmlMap.entries()) {
          const document = parseXml(xml);

          applyParagraphReplacements(document, entryName, replacementLookup);
          applyTextElementReplacements(document, entryName, replacementLookup);

          zip.file(entryName, serializeXml(document));
        }

        return zip.generateAsync({
          type: "nodebuffer",
          compression: "DEFLATE",
          compressionOptions: { level: 6 },
        });
      },
    };
  }
}

function collectParagraphDescriptors(
  document: Document,
  entryName: string,
  descriptors: SegmentDescriptor[],
) {
  const config = paragraphConfigs.find((item) => item.pathPattern.test(entryName));
  if (!config) {
    return;
  }

  const paragraphs = findElementsByLocalName(document, ["p"]);
  let itemIndex = 0;

  paragraphs.forEach((paragraph) => {
    if (!isSafeSingleRunParagraph(paragraph)) {
      return;
    }

    const text = getParagraphText(paragraph);
    if (!isTranslatablePptxText(text)) {
      return;
    }

    descriptors.push({
      id: `${entryName}#${config.entryType}-${itemIndex}`,
      entryName,
      entryType: config.entryType,
      itemIndex,
      text,
      previewPriority: getPreviewPriority(config.entryType),
    });
    itemIndex += 1;
  });
}

function collectTextElementDescriptors(
  document: Document,
  entryName: string,
  descriptors: SegmentDescriptor[],
) {
  const config = textElementConfigs.find((item) => item.pathPattern.test(entryName));
  if (!config) {
    return;
  }

  const elements = findElementsByLocalName(document, config.elementNames);
  let itemIndex = 0;

  elements.forEach((element) => {
    const text = normalizeText(element.textContent ?? "");
    if (!isTranslatablePptxText(text)) {
      return;
    }

    descriptors.push({
      id: `${entryName}#${config.entryType}-${itemIndex}`,
      entryName,
      entryType: config.entryType,
      itemIndex,
      text,
      previewPriority: getPreviewPriority(config.entryType),
    });
    itemIndex += 1;
  });
}

function applyParagraphReplacements(
  document: Document,
  entryName: string,
  replacementLookup: Map<string, string>,
) {
  const config = paragraphConfigs.find((item) => item.pathPattern.test(entryName));
  if (!config) {
    return;
  }

  const paragraphs = findElementsByLocalName(document, ["p"]);
  let itemIndex = 0;

  paragraphs.forEach((paragraph) => {
    if (!isSafeSingleRunParagraph(paragraph)) {
      return;
    }

    const text = getParagraphText(paragraph);
    if (!isTranslatablePptxText(text)) {
      return;
    }

    const replacementText = replacementLookup.get(
      buildLookupKey(config.entryType, entryName, itemIndex),
    );
    if (replacementText !== undefined) {
      if (replacementText === PPTX_REMOVE_SEGMENT_SENTINEL) {
        paragraph.parentNode?.removeChild(paragraph);
        itemIndex += 1;
        return;
      }

      const textNode = findElementsByLocalName(paragraph, ["t"])[0];
      if (textNode) {
        setElementText(textNode, replacementText);
      }
    }

    itemIndex += 1;
  });
}

function applyTextElementReplacements(
  document: Document,
  entryName: string,
  replacementLookup: Map<string, string>,
) {
  const config = textElementConfigs.find((item) => item.pathPattern.test(entryName));
  if (!config) {
    return;
  }

  const elements = findElementsByLocalName(document, config.elementNames);
  let itemIndex = 0;

  elements.forEach((element) => {
    const currentText = normalizeText(element.textContent ?? "");
    if (!isTranslatablePptxText(currentText)) {
      return;
    }

    const replacementText = replacementLookup.get(
      buildLookupKey(config.entryType, entryName, itemIndex),
    );
    if (replacementText !== undefined) {
      if (replacementText === PPTX_REMOVE_SEGMENT_SENTINEL) {
        element.parentNode?.removeChild(element);
        itemIndex += 1;
        return;
      }

      setElementText(element, replacementText);
    }

    itemIndex += 1;
  });
}

function isSafeSingleRunParagraph(paragraph: Element) {
  return findElementsByLocalName(paragraph, ["t"]).length === 1;
}

function getParagraphText(paragraph: Element) {
  const textNode = findElementsByLocalName(paragraph, ["t"])[0];
  return normalizeText(textNode?.textContent ?? "");
}

function matchesAnyConfig(entryName: string) {
  return (
    paragraphConfigs.some((config) => config.pathPattern.test(entryName)) ||
    textElementConfigs.some((config) => config.pathPattern.test(entryName))
  );
}

function parseXml(xml: string) {
  return parser.parseFromString(xml, "text/xml");
}

function serializeXml(document: Document) {
  return serializer.serializeToString(document);
}

function findElementsByLocalName(
  root: Document | Element,
  localNames: string[],
): Element[] {
  const lookup = new Set(localNames);
  const result: Element[] = [];
  const nodes =
    root.nodeType === root.DOCUMENT_NODE
      ? (root as Document).getElementsByTagName("*")
      : (root as Element).getElementsByTagName("*");

  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes.item(index);
    if (node && lookup.has(getLocalName(node))) {
      result.push(node);
    }
  }

  if (root.nodeType !== root.DOCUMENT_NODE && lookup.has(getLocalName(root as Element))) {
    result.unshift(root as Element);
  }

  return result;
}

function getLocalName(node: Element) {
  return node.localName ?? node.nodeName.split(":").pop() ?? node.nodeName;
}

function setElementText(element: Element, text: string) {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }

  if (requiresPreserveWhitespace(text)) {
    element.setAttribute("xml:space", "preserve");
  } else {
    element.removeAttribute("xml:space");
  }

  element.appendChild(element.ownerDocument.createTextNode(text));
}

function requiresPreserveWhitespace(value: string) {
  return value.trim() !== value || value.includes("\n") || value.includes("\t");
}

function normalizeText(value: string) {
  return value.replace(/\r\n/g, "\n");
}

function isTranslatablePptxText(value: string) {
  const trimmedValue = value.trim();
  if (trimmedValue.length === 0) {
    return false;
  }

  // Skip internal placeholder markers such as <#> / <#1> / ‹#› that are not user-visible text.
  if (/^<#[^>]*>$/.test(trimmedValue) || /^‹#[^›]*›$/.test(trimmedValue)) {
    return false;
  }

  // Skip short Office-style placeholder tokens enclosed by angle brackets, e.g. <date>, <footer>, <number>.
  if (
    trimmedValue.length <= 40 &&
    (/^<[A-Za-z0-9_:/.-]+>$/.test(trimmedValue) ||
      /^‹[A-Za-z0-9_:/.-]+›$/.test(trimmedValue))
  ) {
    return false;
  }

  // Skip internal chart/object marker tokens such as #MQprvI#11# that are not display text.
  if (/^#[A-Za-z0-9_-]+(?:#\d+)+#?$/.test(trimmedValue)) {
    return false;
  }

  // Skip tokens that are made only of punctuation/marker characters and have no readable text.
  if (
    trimmedValue.length <= 24 &&
    !/[A-Za-z\u00C0-\u024F\u1E00-\u1EFF]/u.test(trimmedValue) &&
    /^[<>{}\[\]#*~^|\\/._:+\-=\d]+$/u.test(trimmedValue)
  ) {
    return false;
  }

  return true;
}

function buildDescriptorKey(
  descriptor: Pick<SegmentDescriptor, "entryType" | "entryName" | "itemIndex">,
) {
  return buildLookupKey(
    descriptor.entryType,
    descriptor.entryName,
    descriptor.itemIndex,
  );
}

function buildLookupKey(
  entryType: PptxSegmentType,
  entryName: string,
  itemIndex: number,
) {
  return `${entryType}:${entryName}:${itemIndex}`;
}

function getPreviewPriority(entryType: PptxSegmentType) {
  switch (entryType) {
    case "slide-paragraph":
      return 0;
    case "notes-paragraph":
      return 1;
    case "comment-text":
      return 2;
    case "chart-paragraph":
      return 3;
    case "layout-paragraph":
      return 100;
    case "master-paragraph":
      return 101;
    default:
      return 50;
  }
}

export const pptxTranslationPolicy = {
  displayTextEntryTypes: [...DISPLAY_TEXT_ENTRY_TYPES],
  internalReferenceTokensNotTranslated: [...INTERNAL_REFERENCE_TOKENS_NOT_TRANSLATED],
};
