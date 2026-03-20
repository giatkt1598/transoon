import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import JSZip from "jszip";
import { Log } from "../../logger";
import type {
  DocumentHandler,
  ExtractedDocument,
  ExtractedSegment,
} from "../document-types";

const SHARED_STRINGS_PATH = "xl/sharedStrings.xml";
const WORKBOOK_PATH = "xl/workbook.xml";
const CORE_PROPERTIES_PATH = "docProps/core.xml";
const CUSTOM_PROPERTIES_PATH = "docProps/custom.xml";
const CONNECTIONS_PATH = "xl/connections.xml";

const WORKSHEET_PATH_PATTERN = /^xl\/worksheets\/sheet\d+\.xml$/;
const TABLE_PATH_PATTERN = /^xl\/tables\/table\d+\.xml$/;
const PIVOT_TABLE_PATH_PATTERN = /^xl\/pivotTables\/pivotTable\d+\.xml$/;
const QUERY_TABLE_PATH_PATTERN = /^xl\/queryTables\/queryTable\d+\.xml$/;
const SLICER_PATH_PATTERN = /^xl\/slicers\/slicer\d+\.xml$/;
const COMMENTS_PATH_PATTERN = /^xl\/comments\d+\.xml$/;
const THREADED_COMMENTS_PATH_PATTERN =
  /^xl\/threadedComments\/threadedComment\d+\.xml$/;
const DRAWING_PATH_PATTERN = /^xl\/drawings\/drawing\d+\.xml$/;
const CHART_PATH_PATTERN = /^xl\/charts\/chart\d+\.xml$/;

type SegmentEntryType =
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

type SegmentDescriptor = {
  id: string;
  entryName: string;
  entryType: SegmentEntryType;
  itemIndex: number;
  text: string;
};

type AttributeConfig = {
  entryType: SegmentEntryType;
  elementNames: string[];
  attributeName: string;
};

type TextContainerConfig = {
  entryType: SegmentEntryType;
  containerNames: string[];
  textNodeNames: string[];
};

type EntryConfig = {
  entryName?: string;
  pathPattern?: RegExp;
  attributeConfigs?: AttributeConfig[];
  textContainerConfigs?: TextContainerConfig[];
  plainTextElementNames?: Array<{
    entryType: SegmentEntryType;
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

const parser = new DOMParser();
const serializer = new XMLSerializer();

const DISPLAY_TEXT_ENTRY_TYPES: readonly SegmentEntryType[] = [
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

// These values often behave as workbook identifiers, styles, or internal references,
// so they are intentionally excluded from translation.
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

export class XlsxDocumentHandler implements DocumentHandler {
  readonly supportedExtensions = [".xlsx"];

  async extract(fileName: string, buffer: Buffer): Promise<ExtractedDocument> {
    const zip = await JSZip.loadAsync(buffer);
    const descriptors: SegmentDescriptor[] = [];
    const entryXmlMap = new Map<string, string>();
    const logger = Log.forContext({
      documentHandler: "xlsx",
      fileName,
    });

    await this.collectSharedStrings(zip, descriptors, entryXmlMap);
    await this.collectConfiguredEntries(zip, descriptors, entryXmlMap);
    await this.collectChartEntries(zip, descriptors, entryXmlMap, logger);

    return {
      documentType: "xlsx",
      fileName,
      segments: descriptors.map((descriptor) => ({
        id: descriptor.id,
        text: descriptor.text,
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

          if (entryName === SHARED_STRINGS_PATH) {
            this.applySharedStrings(document, entryName, replacementLookup);
          } else if (CHART_PATH_PATTERN.test(entryName)) {
            this.applyChartEntry(document, entryName, replacementLookup, logger);
          } else {
            this.applyConfiguredEntry(
              document,
              entryName,
              replacementLookup,
            );
          }

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

  private async collectSharedStrings(
    zip: JSZip,
    descriptors: SegmentDescriptor[],
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

      descriptors.push({
        id: `${SHARED_STRINGS_PATH}#shared-string-${itemIndex}`,
        entryName: SHARED_STRINGS_PATH,
        entryType: "shared-string",
        itemIndex,
        text,
      });
    });
  }

  private async collectConfiguredEntries(
    zip: JSZip,
    descriptors: SegmentDescriptor[],
    entryXmlMap: Map<string, string>,
  ) {
    for (const config of xlsxEntryConfigs) {
      const entryNames = await resolveZipEntryNames(zip, config);

      for (const entryName of entryNames) {
        if (entryXmlMap.has(entryName)) {
          this.collectFromXml(
            entryName,
            entryXmlMap.get(entryName) ?? "",
            config,
            descriptors,
          );
          continue;
        }

        const xml = await zip.file(entryName)?.async("text");
        if (!xml) {
          continue;
        }

        entryXmlMap.set(entryName, xml);
        this.collectFromXml(entryName, xml, config, descriptors);
      }
    }
  }

  private async collectChartEntries(
    zip: JSZip,
    descriptors: SegmentDescriptor[],
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
        descriptors.push({
          id: `${entryName}#chart-rich-text-${itemIndex}`,
          entryName,
          entryType: "chart-rich-text",
          itemIndex,
          text,
        });
      });
    }
  }

  private collectFromXml(
    entryName: string,
    xml: string,
    config: EntryConfig,
    descriptors: SegmentDescriptor[],
  ) {
    const document = parseXml(xml);

    config.attributeConfigs?.forEach((attributeConfig) => {
      collectAttributeDescriptors(document, entryName, attributeConfig, descriptors);
    });

    config.textContainerConfigs?.forEach((textConfig) => {
      collectTextContainerDescriptors(document, entryName, textConfig, descriptors);
    });

    config.plainTextElementNames?.forEach((plainTextConfig) => {
      collectPlainTextElementDescriptors(
        document,
        entryName,
        plainTextConfig,
        descriptors,
      );
    });
  }

  private applySharedStrings(
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

  private applyConfiguredEntry(
    document: Document,
    entryName: string,
    replacementLookup: Map<string, string>,
  ) {
    const config = xlsxEntryConfigs.find((entry) =>
      matchesEntryConfig(entryName, entry),
    );

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

  private applyChartEntry(
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
}

function collectAttributeDescriptors(
  document: Document,
  entryName: string,
  config: AttributeConfig,
  descriptors: SegmentDescriptor[],
) {
  const elements = findElementsByLocalName(document, config.elementNames);
  let itemIndex = 0;

  elements.forEach((element) => {
    const text = element.getAttribute(config.attributeName) ?? "";
    if (text.trim().length === 0) {
      itemIndex += 1;
      return;
    }

    descriptors.push({
      id: `${entryName}#${config.entryType}-${itemIndex}`,
      entryName,
      entryType: config.entryType,
      itemIndex,
      text,
    });
    itemIndex += 1;
  });
}

function collectTextContainerDescriptors(
  document: Document,
  entryName: string,
  config: TextContainerConfig,
  descriptors: SegmentDescriptor[],
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

    descriptors.push({
      id: `${entryName}#${config.entryType}-${itemIndex}`,
      entryName,
      entryType: config.entryType,
      itemIndex,
      text,
    });
    itemIndex += 1;
  });
}

function collectPlainTextElementDescriptors(
  document: Document,
  entryName: string,
  config: { entryType: SegmentEntryType; elementNames: string[] },
  descriptors: SegmentDescriptor[],
) {
  const elements = findElementsByLocalName(document, config.elementNames);
  let itemIndex = 0;

  elements.forEach((element) => {
    const text = normalizePlainText(element.textContent ?? "");
    if (text.trim().length === 0) {
      itemIndex += 1;
      return;
    }

    descriptors.push({
      id: `${entryName}#${config.entryType}-${itemIndex}`,
      entryName,
      entryType: config.entryType,
      itemIndex,
      text,
    });
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
  config: { entryType: SegmentEntryType; elementNames: string[] },
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

function buildDescriptorKey(descriptor: SegmentDescriptor) {
  return buildLookupKey(
    descriptor.entryType,
    descriptor.entryName,
    descriptor.itemIndex,
  );
}

function buildLookupKey(
  entryType: SegmentEntryType,
  entryName: string,
  itemIndex: number,
) {
  return `${entryType}:${entryName}:${itemIndex}`;
}

export const xlsxTranslationPolicy = {
  displayTextEntryTypes: [...DISPLAY_TEXT_ENTRY_TYPES],
  internalReferenceTokensNotTranslated: [...INTERNAL_REFERENCE_TOKENS_NOT_TRANSLATED],
};
