import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import JSZip from "jszip";
import type { ExtractedSegment } from "./document-types";
import { Log } from "../logger";
import {
  rebuildSegmentedText,
  segmentTextBlock,
  type SegmentedTextBlock,
} from "./segmentation/text-segmentation";

const SHARED_STRINGS_PATH = "xl/sharedStrings.xml";
const WORKBOOK_PATH = "xl/workbook.xml";
const CORE_PROPERTIES_PATH = "docProps/core.xml";
const CUSTOM_PROPERTIES_PATH = "docProps/custom.xml";
const CONNECTIONS_PATH = "xl/connections.xml";

const WORKSHEET_PATH_PATTERN = /^xl\/worksheets\/sheet\d+\.xml$/u;
const TABLE_PATH_PATTERN = /^xl\/tables\/table\d+\.xml$/u;
const PIVOT_TABLE_PATH_PATTERN = /^xl\/pivotTables\/pivotTable\d+\.xml$/u;
const QUERY_TABLE_PATH_PATTERN = /^xl\/queryTables\/queryTable\d+\.xml$/u;
const SLICER_PATH_PATTERN = /^xl\/slicers\/slicer\d+\.xml$/u;
const COMMENTS_PATH_PATTERN = /^xl\/comments\d+\.xml$/u;
const THREADED_COMMENTS_PATH_PATTERN =
  /^xl\/threadedComments\/threadedComment\d+\.xml$/u;
const DRAWING_PATH_PATTERN = /^xl\/drawings\/drawing\d+\.xml$/u;
const CHART_PATH_PATTERN = /^xl\/charts\/chart\d+\.xml$/u;

export type XlsxSegmentEntryType =
  | "shared-string"
  | "inline-string"
  | "workbook-defined-name"
  | "hyperlink-display"
  | "validation-prompt-title"
  | "validation-prompt"
  | "validation-error-title"
  | "validation-error"
  | "header-footer"
  | "table-column-name"
  | "table-total-label"
  | "comment"
  | "threaded-comment"
  | "drawing-text"
  | "chart-rich-text"
  | "core-property"
  | "custom-property"
  | "connection-description"
  | "query-table-name"
  | "slicer-name"
  | "slicer-caption"
  | "pivot-data-caption"
  | "pivot-error-caption"
  | "pivot-field-caption"
  | "pivot-data-field-name";

export type XlsxSegmentDescriptor = {
  id: string;
  entryName: string;
  entryType: XlsxSegmentEntryType;
  itemIndex: number;
  text: string;
};

export type XlsxSegmentBlock = {
  entryName: string;
  entryType: XlsxSegmentEntryType;
  itemIndex: number;
  segmentedText: SegmentedTextBlock;
  segmentTexts: string[];
  segmentIds: string[];
};

type AttributeConfig = {
  entryType: XlsxSegmentEntryType;
  elementNames: string[];
  attributeName: string;
};

type TextContainerConfig = {
  entryType: XlsxSegmentEntryType;
  containerNames: string[];
  textNodeNames: string[];
};

type EntryConfig = {
  entryName?: string;
  pathPattern?: RegExp;
  attributeConfigs?: AttributeConfig[];
  textContainerConfigs?: TextContainerConfig[];
  plainTextElementNames?: Array<{
    entryType: XlsxSegmentEntryType;
    elementNames: string[];
  }>;
};

type ChartTextTarget =
  | {
      kind: "rich-paragraph";
      textNodes: Element[];
    }
  | {
      kind: "cache-point";
      valueElement: Element;
    }
  | {
      kind: "direct-text";
      valueElement: Element;
    };

export type XlsxExtractionPlan = {
  blocks: XlsxSegmentBlock[];
  segments: ExtractedSegment[];
  entryXmlMap: Map<string, string>;
};

const parser = new DOMParser();
const serializer = new XMLSerializer();

const DISPLAY_TEXT_ENTRY_TYPES: readonly XlsxSegmentEntryType[] = [
  "shared-string",
  "inline-string",
  "workbook-defined-name",
  "hyperlink-display",
  "validation-prompt-title",
  "validation-prompt",
  "validation-error-title",
  "validation-error",
  "header-footer",
  "table-column-name",
  "table-total-label",
  "comment",
  "threaded-comment",
  "drawing-text",
  "chart-rich-text",
  "core-property",
  "custom-property",
  "connection-description",
  "query-table-name",
  "slicer-name",
  "slicer-caption",
  "pivot-data-caption",
  "pivot-error-caption",
  "pivot-field-caption",
  "pivot-data-field-name",
] as const;

const INTERNAL_REFERENCE_TOKENS_NOT_TRANSLATED = [
  "sheet name",
  "pivotTableStyle",
  "pageStyle",
  "pageField name",
  "connection name",
  "queryTableField name",
  "slicerCache name",
  "definedName value",
  "vml textbox rich content",
] as const;

const xlsxEntryConfigs: EntryConfig[] = [
  {
    entryName: WORKBOOK_PATH,
    attributeConfigs: [
      {
        entryType: "workbook-defined-name",
        elementNames: ["definedName"],
        attributeName: "name",
      },
    ],
  },
  {
    pathPattern: WORKSHEET_PATH_PATTERN,
    attributeConfigs: [
      {
        entryType: "hyperlink-display",
        elementNames: ["hyperlink"],
        attributeName: "display",
      },
      {
        entryType: "validation-prompt-title",
        elementNames: ["dataValidation"],
        attributeName: "promptTitle",
      },
      {
        entryType: "validation-prompt",
        elementNames: ["dataValidation"],
        attributeName: "prompt",
      },
      {
        entryType: "validation-error-title",
        elementNames: ["dataValidation"],
        attributeName: "errorTitle",
      },
      {
        entryType: "validation-error",
        elementNames: ["dataValidation"],
        attributeName: "error",
      },
    ],
    textContainerConfigs: [
      {
        entryType: "inline-string",
        containerNames: ["is"],
        textNodeNames: ["t"],
      },
      {
        entryType: "header-footer",
        containerNames: [
          "oddHeader",
          "oddFooter",
          "evenHeader",
          "evenFooter",
          "firstHeader",
          "firstFooter",
        ],
        textNodeNames: [],
      },
    ],
  },
  {
    pathPattern: TABLE_PATH_PATTERN,
    attributeConfigs: [
      {
        entryType: "table-column-name",
        elementNames: ["tableColumn"],
        attributeName: "name",
      },
      {
        entryType: "table-total-label",
        elementNames: ["tableColumn"],
        attributeName: "totalsRowLabel",
      },
    ],
  },
  {
    pathPattern: COMMENTS_PATH_PATTERN,
    textContainerConfigs: [
      {
        entryType: "comment",
        containerNames: ["comment"],
        textNodeNames: ["t"],
      },
    ],
  },
  {
    pathPattern: THREADED_COMMENTS_PATH_PATTERN,
    textContainerConfigs: [
      {
        entryType: "threaded-comment",
        containerNames: ["threadedComment"],
        textNodeNames: ["text"],
      },
    ],
  },
  {
    pathPattern: DRAWING_PATH_PATTERN,
    textContainerConfigs: [
      {
        entryType: "drawing-text",
        containerNames: ["txBody"],
        textNodeNames: ["t"],
      },
    ],
  },
  {
    entryName: CORE_PROPERTIES_PATH,
    plainTextElementNames: [
      {
        entryType: "core-property",
        elementNames: ["title", "subject", "description", "keywords", "category"],
      },
    ],
  },
  {
    entryName: CUSTOM_PROPERTIES_PATH,
    plainTextElementNames: [
      {
        entryType: "custom-property",
        elementNames: ["lpwstr"],
      },
    ],
  },
  {
    entryName: CONNECTIONS_PATH,
    attributeConfigs: [
      {
        entryType: "connection-description",
        elementNames: ["connection"],
        attributeName: "description",
      },
    ],
  },
  {
    pathPattern: QUERY_TABLE_PATH_PATTERN,
    attributeConfigs: [
      {
        entryType: "query-table-name",
        elementNames: ["queryTable"],
        attributeName: "name",
      },
    ],
  },
  {
    pathPattern: SLICER_PATH_PATTERN,
    attributeConfigs: [
      {
        entryType: "slicer-name",
        elementNames: ["slicer"],
        attributeName: "name",
      },
      {
        entryType: "slicer-caption",
        elementNames: ["slicer"],
        attributeName: "caption",
      },
    ],
  },
  {
    pathPattern: PIVOT_TABLE_PATH_PATTERN,
    attributeConfigs: [
      {
        entryType: "pivot-data-caption",
        elementNames: ["pivotTableDefinition"],
        attributeName: "dataCaption",
      },
      {
        entryType: "pivot-error-caption",
        elementNames: ["pivotTableDefinition"],
        attributeName: "errorCaption",
      },
      {
        entryType: "pivot-field-caption",
        elementNames: ["field"],
        attributeName: "caption",
      },
      {
        entryType: "pivot-data-field-name",
        elementNames: ["dataField"],
        attributeName: "name",
      },
    ],
  },
] as const;

export async function buildXlsxExtractionPlan(
  zip: JSZip,
  logger: ReturnType<typeof Log.forContext>,
): Promise<XlsxExtractionPlan> {
  const blocks: XlsxSegmentBlock[] = [];
  const entryXmlMap = new Map<string, string>();

  await collectSharedStrings(zip, blocks, entryXmlMap);
  await collectConfiguredEntries(zip, blocks, entryXmlMap);
  await collectChartEntries(zip, blocks, entryXmlMap, logger);

  return {
    blocks,
    segments: flattenBlocksToSegments(blocks),
    entryXmlMap,
  };
}

export async function applyXlsxExtractionPlan(
  zip: JSZip,
  plan: XlsxExtractionPlan,
  nextSegments: string[],
  logger: ReturnType<typeof Log.forContext>,
) {
  const replacementLookup = new Map<string, string>();
  let replacementIndex = 0;

  plan.blocks.forEach((block) => {
    const replacementTexts = block.segmentTexts.map((segmentText) => {
      const nextText = nextSegments[replacementIndex] ?? segmentText;
      replacementIndex += 1;
      return nextText;
    });

    replacementLookup.set(
      buildLookupKey(block.entryType, block.entryName, block.itemIndex),
      rebuildSegmentedText(block.segmentedText, replacementTexts),
    );
  });

  for (const [entryName, xml] of plan.entryXmlMap.entries()) {
    const document = parseXml(xml);

    if (entryName === SHARED_STRINGS_PATH) {
      applySharedStrings(document, entryName, replacementLookup);
    } else if (CHART_PATH_PATTERN.test(entryName)) {
      applyChartEntry(document, entryName, replacementLookup, logger);
    } else {
      applyConfiguredEntry(document, entryName, replacementLookup);
    }

    zip.file(entryName, serializeXml(document));
  }

  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

async function collectSharedStrings(
  zip: JSZip,
  blocks: XlsxSegmentBlock[],
  entryXmlMap: Map<string, string>,
) {
  const sharedStringsXml = await zip.file(SHARED_STRINGS_PATH)?.async("text");
  if (!sharedStringsXml) {
    return;
  }

  entryXmlMap.set(SHARED_STRINGS_PATH, sharedStringsXml);
  const document = parseXml(sharedStringsXml);
  const sharedStringItems = findElementsByLocalName(document, ["si"]);

  sharedStringItems.forEach((item, itemIndex) => {
    const text = getContainerText(item, ["t"]);
    if (text.trim().length === 0) {
      return;
    }

    pushSegmentedBlock(
      blocks,
      SHARED_STRINGS_PATH,
      "shared-string",
      itemIndex,
      text,
    );
  });
}

async function collectConfiguredEntries(
  zip: JSZip,
  blocks: XlsxSegmentBlock[],
  entryXmlMap: Map<string, string>,
) {
  for (const config of xlsxEntryConfigs) {
    const entryNames = await resolveZipEntryNames(zip, config);

    for (const entryName of entryNames) {
      if (entryXmlMap.has(entryName)) {
        collectFromXml(
          entryName,
          entryXmlMap.get(entryName) ?? "",
          config,
          blocks,
        );
        continue;
      }

      const xml = await zip.file(entryName)?.async("text");
      if (!xml) {
        continue;
      }

      entryXmlMap.set(entryName, xml);
      collectFromXml(entryName, xml, config, blocks);
    }
  }
}

async function collectChartEntries(
  zip: JSZip,
  blocks: XlsxSegmentBlock[],
  entryXmlMap: Map<string, string>,
  logger: ReturnType<typeof Log.forContext>,
) {
  const chartEntryNames = Object.values(zip.files)
    .filter((entry) => CHART_PATH_PATTERN.test(entry.name))
    .map((entry) => entry.name);

  for (const entryName of chartEntryNames) {
    const xml = await zip.file(entryName)?.async("text");
    if (!xml) {
      continue;
    }

    entryXmlMap.set(entryName, xml);
    const document = parseXml(xml);
    const targets = findChartTextTargets(document);
    const collectedTargets = targets
      .map((target, itemIndex) => ({
        target,
        itemIndex,
        text: normalizePlainText(getChartTargetText(target)),
      }))
      .filter((item) => item.text.trim().length > 0);

    await logger.debug("Collected chart translation targets from {entryName}", {
      entryName,
      targetCount: collectedTargets.length,
      targetKinds: collectedTargets.map((item) => item.target.kind),
      sampleTexts: collectedTargets.slice(0, 8).map((item) => item.text),
    });

    collectedTargets.forEach(({ itemIndex, text }) => {
      pushSegmentedBlock(
        blocks,
        entryName,
        "chart-rich-text",
        itemIndex,
        text,
      );
    });
  }
}

function collectFromXml(
  entryName: string,
  xml: string,
  config: EntryConfig,
  blocks: XlsxSegmentBlock[],
) {
  const document = parseXml(xml);

  config.attributeConfigs?.forEach((attributeConfig) => {
    collectAttributeDescriptors(document, entryName, attributeConfig, blocks);
  });

  config.textContainerConfigs?.forEach((textConfig) => {
    collectTextContainerDescriptors(document, entryName, textConfig, blocks);
  });

  config.plainTextElementNames?.forEach((plainTextConfig) => {
    collectPlainTextElementDescriptors(
      document,
      entryName,
      plainTextConfig,
      blocks,
    );
  });
}

function applySharedStrings(
  document: Document,
  entryName: string,
  replacementLookup: Map<string, string>,
) {
  const sharedStringItems = findElementsByLocalName(document, ["si"]);

  sharedStringItems.forEach((item, itemIndex) => {
    const lookupKey = buildLookupKey("shared-string", entryName, itemIndex);
    const replacementText = replacementLookup.get(lookupKey);

    if (replacementText === undefined) {
      return;
    }

    replaceContainerText(item, ["t"], replacementText);
  });
}

function applyConfiguredEntry(
  document: Document,
  entryName: string,
  replacementLookup: Map<string, string>,
) {
  const config = xlsxEntryConfigs.find((entry) => matchesEntryConfig(entryName, entry));
  if (!config) {
    return;
  }

  config.attributeConfigs?.forEach((attributeConfig) => {
    applyAttributeReplacements(
      document,
      entryName,
      attributeConfig,
      replacementLookup,
    );
  });

  config.textContainerConfigs?.forEach((textConfig) => {
    applyTextContainerReplacements(
      document,
      entryName,
      textConfig,
      replacementLookup,
    );
  });

  config.plainTextElementNames?.forEach((plainTextConfig) => {
    applyPlainTextElementReplacements(
      document,
      entryName,
      plainTextConfig,
      replacementLookup,
    );
  });
}

function applyChartEntry(
  document: Document,
  entryName: string,
  replacementLookup: Map<string, string>,
  logger: ReturnType<typeof Log.forContext>,
) {
  const targets = findChartTextTargets(document);
  let replacedCount = 0;

  targets.forEach((target, itemIndex) => {
    const lookupKey = buildLookupKey("chart-rich-text", entryName, itemIndex);
    const replacementText = replacementLookup.get(lookupKey);
    if (replacementText === undefined) {
      return;
    }

    applyChartTargetText(target, replacementText);
    replacedCount += 1;
  });

  void logger.debug("Applied chart translation targets to {entryName}", {
    entryName,
    targetCount: targets.length,
    replacedCount,
  });
}

function collectAttributeDescriptors(
  document: Document,
  entryName: string,
  config: AttributeConfig,
  blocks: XlsxSegmentBlock[],
) {
  const elements = findElementsByLocalName(document, config.elementNames);
  let itemIndex = 0;

  elements.forEach((element) => {
    const text = element.getAttribute(config.attributeName) ?? "";
    if (text.trim().length === 0) {
      itemIndex += 1;
      return;
    }

    pushSegmentedBlock(blocks, entryName, config.entryType, itemIndex, text);
    itemIndex += 1;
  });
}

function collectTextContainerDescriptors(
  document: Document,
  entryName: string,
  config: TextContainerConfig,
  blocks: XlsxSegmentBlock[],
) {
  const containers = findElementsByLocalName(document, config.containerNames);
  let itemIndex = 0;

  containers.forEach((container) => {
    const text =
      config.textNodeNames.length > 0
        ? getSafeContainerText(container, config.textNodeNames)
        : normalizePlainText(container.textContent ?? "");

    if (!text || text.trim().length === 0) {
      itemIndex += 1;
      return;
    }

    pushSegmentedBlock(blocks, entryName, config.entryType, itemIndex, text);
    itemIndex += 1;
  });
}

function collectPlainTextElementDescriptors(
  document: Document,
  entryName: string,
  config: { entryType: XlsxSegmentEntryType; elementNames: string[] },
  blocks: XlsxSegmentBlock[],
) {
  const elements = findElementsByLocalName(document, config.elementNames);
  let itemIndex = 0;

  elements.forEach((element) => {
    const text = normalizePlainText(element.textContent ?? "");
    if (text.trim().length === 0) {
      itemIndex += 1;
      return;
    }

    pushSegmentedBlock(blocks, entryName, config.entryType, itemIndex, text);
    itemIndex += 1;
  });
}

function applyAttributeReplacements(
  document: Document,
  entryName: string,
  config: AttributeConfig,
  replacementLookup: Map<string, string>,
) {
  const elements = findElementsByLocalName(document, config.elementNames);
  let itemIndex = 0;

  elements.forEach((element) => {
    const lookupKey = buildLookupKey(config.entryType, entryName, itemIndex);
    const replacementText = replacementLookup.get(lookupKey);
    if (replacementText !== undefined) {
      element.setAttribute(config.attributeName, replacementText);
    }
    itemIndex += 1;
  });
}

function applyTextContainerReplacements(
  document: Document,
  entryName: string,
  config: TextContainerConfig,
  replacementLookup: Map<string, string>,
) {
  const containers = findElementsByLocalName(document, config.containerNames);
  let itemIndex = 0;

  containers.forEach((container) => {
    const lookupKey = buildLookupKey(config.entryType, entryName, itemIndex);
    const replacementText = replacementLookup.get(lookupKey);
    if (replacementText !== undefined) {
      if (config.textNodeNames.length > 0) {
        if (!isSafeSingleRunContainer(container, config.textNodeNames)) {
          itemIndex += 1;
          return;
        }

        replaceContainerText(container, config.textNodeNames, replacementText);
      } else {
        setElementPlainText(container, replacementText);
      }
    }
    itemIndex += 1;
  });
}

function applyPlainTextElementReplacements(
  document: Document,
  entryName: string,
  config: { entryType: XlsxSegmentEntryType; elementNames: string[] },
  replacementLookup: Map<string, string>,
) {
  const elements = findElementsByLocalName(document, config.elementNames);
  let itemIndex = 0;

  elements.forEach((element) => {
    const lookupKey = buildLookupKey(config.entryType, entryName, itemIndex);
    const replacementText = replacementLookup.get(lookupKey);
    if (replacementText !== undefined) {
      setElementPlainText(element, replacementText);
    }
    itemIndex += 1;
  });
}

async function resolveZipEntryNames(zip: JSZip, config: EntryConfig) {
  if (config.entryName) {
    return zip.file(config.entryName) ? [config.entryName] : [];
  }

  if (!config.pathPattern) {
    return [] as string[];
  }

  return Object.values(zip.files)
    .filter((entry) => config.pathPattern?.test(entry.name))
    .map((entry) => entry.name);
}

function matchesEntryConfig(entryName: string, config: EntryConfig) {
  if (config.entryName) {
    return config.entryName === entryName;
  }

  return config.pathPattern?.test(entryName) ?? false;
}

function parseXml(xml: string) {
  return parser.parseFromString(xml, "text/xml");
}

function serializeXml(document: Document) {
  return serializer.serializeToString(document);
}

function findElementsByLocalName(root: Document | Element, localNames: string[]): Element[] {
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

function getContainerText(container: Element, textNodeNames: string[]) {
  const textNodes = findElementsByLocalName(container, textNodeNames);
  return textNodes
    .map((node) => normalizePlainText(node.textContent ?? ""))
    .join("");
}

function getSafeContainerText(container: Element, textNodeNames: string[]) {
  if (!isSafeSingleRunContainer(container, textNodeNames)) {
    return null;
  }

  return getContainerText(container, textNodeNames);
}

function replaceContainerText(
  container: Element,
  textNodeNames: string[],
  replacementText: string,
) {
  const textNodes = findElementsByLocalName(container, textNodeNames);

  if (textNodes.length === 0) {
    setElementPlainText(container, replacementText);
    return;
  }

  textNodes.forEach((node, index) => {
    setElementPlainText(node, index === 0 ? replacementText : "");
  });
}

function setElementPlainText(element: Element, text: string) {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }

  element.appendChild(element.ownerDocument.createTextNode(text));
}

function isSafeSingleRunContainer(container: Element, textNodeNames: string[]) {
  return findElementsByLocalName(container, textNodeNames).length <= 1;
}

function getLocalName(node: Element) {
  return node.localName ?? node.nodeName.split(":").pop() ?? node.nodeName;
}

function findChartTextTargets(document: Document): ChartTextTarget[] {
  return [
    ...findChartRichParagraphTargets(document),
    ...findChartCachePointTargets(document),
    ...findChartDirectTextTargets(document),
  ];
}

function findChartRichParagraphTargets(document: Document): ChartTextTarget[] {
  const richElements = findElementsByLocalName(document, ["rich"]);
  const targets: ChartTextTarget[] = [];

  richElements.forEach((richElement) => {
    const paragraphs = findElementsByLocalName(richElement, ["p"]);

    paragraphs.forEach((paragraph) => {
      const textNodes = findElementsByLocalName(paragraph, ["t"]);
      if (textNodes.length === 0) {
        return;
      }

      targets.push({
        kind: "rich-paragraph",
        textNodes,
      });
    });
  });

  return targets;
}

function findChartCachePointTargets(document: Document): ChartTextTarget[] {
  const pointElements = findElementsByLocalName(document, ["pt"]);
  const targets: ChartTextTarget[] = [];

  pointElements.forEach((pointElement) => {
    if (!hasAncestor(pointElement, ["strCache", "multiLvlStrCache"])) {
      return;
    }

    const valueElement = findDirectChildByLocalName(pointElement, "v");
    if (!valueElement) {
      return;
    }

    const text = normalizePlainText(valueElement.textContent ?? "");
    if (text.trim().length === 0) {
      return;
    }

    targets.push({
      kind: "cache-point",
      valueElement,
    });
  });

  return targets;
}

function findChartDirectTextTargets(document: Document): ChartTextTarget[] {
  const textContainers = findElementsByLocalName(document, ["tx"]);
  const targets: ChartTextTarget[] = [];

  textContainers.forEach((textContainer) => {
    if (
      findDirectChildByLocalName(textContainer, "rich") ||
      findDirectChildByLocalName(textContainer, "strRef") ||
      findDirectChildByLocalName(textContainer, "multiLvlStrRef")
    ) {
      return;
    }

    const valueElement = findDirectChildByLocalName(textContainer, "v");
    if (!valueElement) {
      return;
    }

    const text = normalizePlainText(valueElement.textContent ?? "");
    if (text.trim().length === 0) {
      return;
    }

    targets.push({
      kind: "direct-text",
      valueElement,
    });
  });

  return targets;
}

function getChartTargetText(target: ChartTextTarget) {
  switch (target.kind) {
    case "rich-paragraph":
      return target.textNodes
        .map((textNode) => normalizePlainText(textNode.textContent ?? ""))
        .join("");
    case "cache-point":
    case "direct-text":
      return normalizePlainText(target.valueElement.textContent ?? "");
  }
}

function applyChartTargetText(target: ChartTextTarget, replacementText: string) {
  switch (target.kind) {
    case "rich-paragraph":
      target.textNodes.forEach((textNode, index) => {
        setElementPlainText(textNode, index === 0 ? replacementText : "");
      });
      return;
    case "cache-point":
    case "direct-text":
      setElementPlainText(target.valueElement, replacementText);
      return;
  }
}

function hasAncestor(element: Element, localNames: string[]) {
  const lookup = new Set(localNames);
  let current = element.parentNode;

  while (current) {
    if (current.nodeType === current.ELEMENT_NODE) {
      const currentElement = current as Element;
      if (lookup.has(getLocalName(currentElement))) {
        return true;
      }
    }

    current = current.parentNode;
  }

  return false;
}

function findDirectChildByLocalName(element: Element, localName: string) {
  const children = element.childNodes;

  for (let index = 0; index < children.length; index += 1) {
    const child = children.item(index);
    if (child?.nodeType === child.ELEMENT_NODE && getLocalName(child as Element) === localName) {
      return child as Element;
    }
  }

  return null;
}

function normalizePlainText(value: string) {
  return value.replace(/\r\n/g, "\n");
}

function buildLookupKey(
  entryType: XlsxSegmentEntryType,
  entryName: string,
  itemIndex: number,
) {
  return `${entryType}:${entryName}:${itemIndex}`;
}

export function buildXlsxSegmentLookupKey(
  entryType: XlsxSegmentEntryType,
  entryName: string,
  itemIndex: number,
) {
  return buildLookupKey(entryType, entryName, itemIndex);
}

export const xlsxTranslationPolicy = {
  displayTextEntryTypes: [...DISPLAY_TEXT_ENTRY_TYPES],
  internalReferenceTokensNotTranslated: [...INTERNAL_REFERENCE_TOKENS_NOT_TRANSLATED],
};

function pushSegmentedBlock(
  blocks: XlsxSegmentBlock[],
  entryName: string,
  entryType: XlsxSegmentEntryType,
  itemIndex: number,
  text: string,
) {
  const segmentedText = segmentTextBlock(text, "paragraph");
  if (segmentedText.segmentTexts.length === 0) {
    return;
  }

  blocks.push({
    entryName,
    entryType,
    itemIndex,
    segmentedText,
    segmentTexts: segmentedText.segmentTexts,
    segmentIds: segmentedText.segmentTexts.map(
      (_segmentText, segmentIndex) =>
        `${entryName}#${entryType}-${itemIndex}-s${segmentIndex}`,
    ),
  });
}

function flattenBlocksToSegments(blocks: XlsxSegmentBlock[]): ExtractedSegment[] {
  return blocks.flatMap((block) =>
    block.segmentIds.map((segmentId, index) => ({
      id: segmentId,
      text: block.segmentTexts[index] ?? "",
    })),
  );
}
