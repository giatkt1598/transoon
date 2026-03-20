import JSZip from "jszip";
import type {
  DocumentHandler,
  ExtractedDocument,
  ExtractedSegment,
} from "../document-types";

const SHARED_STRINGS_PATH = "xl/sharedStrings.xml";
const WORKSHEET_PATH_PATTERN = /^xl\/worksheets\/sheet\d+\.xml$/;
const COMMENTS_PATH_PATTERN = /^xl\/comments\d+\.xml$/;
const THREADED_COMMENTS_PATH_PATTERN =
  /^xl\/threadedComments\/threadedComment\d+\.xml$/;
const DRAWING_PATH_PATTERN = /^xl\/drawings\/drawing\d+\.xml$/;
const CHART_PATH_PATTERN = /^xl\/charts\/chart\d+\.xml$/;

const sharedStringItemPattern = /<si\b[^>]*>[\s\S]*?<\/si>/g;
const inlineStringPattern =
  /(<c\b[^>]*\bt="inlineStr"[^>]*>[\s\S]*?<is\b[^>]*>)([\s\S]*?)(<\/is>[\s\S]*?<\/c>)/g;
const commentItemPattern = /<comment\b[^>]*>[\s\S]*?<\/comment>/g;
const threadedCommentItemPattern =
  /<threadedComment\b[^>]*>[\s\S]*?<\/threadedComment>/g;
const drawingTextBodyPattern =
  /(<(?:xdr|a):txBody\b[^>]*>)([\s\S]*?)(<\/(?:xdr|a):txBody>)/g;
const chartRichTextPattern = /(<c:rich\b[^>]*>)([\s\S]*?)(<\/c:rich>)/g;
const textNodePattern = /(<t(?:\s+[^>]*)?>)([\s\S]*?)(<\/t>)/g;
const drawingTextNodePattern = /(<a:t(?:\s+[^>]*)?>)([\s\S]*?)(<\/a:t>)/g;
const threadedTextPattern = /(<text(?:\s+[^>]*)?>)([\s\S]*?)(<\/text>)/g;

type SegmentDescriptor = {
  id: string;
  entryName: string;
  entryType:
    | "shared-string"
    | "inline-string"
    | "comment"
    | "threaded-comment"
    | "drawing-text"
    | "chart-rich-text";
  itemIndex: number;
  text: string;
};

export class XlsxDocumentHandler implements DocumentHandler {
  readonly supportedExtensions = [".xlsx"];

  async extract(fileName: string, buffer: Buffer): Promise<ExtractedDocument> {
    const zip = await JSZip.loadAsync(buffer);
    const segments: ExtractedSegment[] = [];
    const descriptors: SegmentDescriptor[] = [];
    const entryXmlMap = new Map<string, string>();

    await this.collectSharedStrings(zip, segments, descriptors, entryXmlMap);
    await this.collectWorksheetInlineStrings(
      zip,
      segments,
      descriptors,
      entryXmlMap,
    );
    await this.collectCommentEntries(
      zip,
      COMMENTS_PATH_PATTERN,
      commentItemPattern,
      textNodePattern,
      "comment",
      segments,
      descriptors,
      entryXmlMap,
    );
    await this.collectCommentEntries(
      zip,
      THREADED_COMMENTS_PATH_PATTERN,
      threadedCommentItemPattern,
      threadedTextPattern,
      "threaded-comment",
      segments,
      descriptors,
      entryXmlMap,
    );
    await this.collectRichTextEntries(
      zip,
      DRAWING_PATH_PATTERN,
      drawingTextBodyPattern,
      drawingTextNodePattern,
      "drawing-text",
      segments,
      descriptors,
      entryXmlMap,
    );
    await this.collectRichTextEntries(
      zip,
      CHART_PATH_PATTERN,
      chartRichTextPattern,
      drawingTextNodePattern,
      "chart-rich-text",
      segments,
      descriptors,
      entryXmlMap,
    );

    return {
      documentType: "xlsx",
      fileName,
      segments,
      replaceSegments: async (nextSegments: string[]) => {
        const replacementLookup = new Map<string, string>();

        descriptors.forEach((descriptor, index) => {
          replacementLookup.set(
            buildDescriptorKey(descriptor),
            nextSegments[index] ?? descriptor.text,
          );
        });

        const sharedStringsXml = entryXmlMap.get(SHARED_STRINGS_PATH);
        if (sharedStringsXml) {
          let itemIndex = 0;
          const nextSharedStringsXml = sharedStringsXml.replace(
            sharedStringItemPattern,
            (itemXml) => {
              const replacementText =
                replacementLookup.get(
                  buildLookupKey("shared-string", SHARED_STRINGS_PATH, itemIndex),
                ) ?? decodeXml(extractTextFromXml(itemXml, textNodePattern));
              itemIndex += 1;
              return replaceTextNodes(itemXml, replacementText, textNodePattern);
            },
          );
          zip.file(SHARED_STRINGS_PATH, nextSharedStringsXml);
        }

        for (const [entryName, xml] of entryXmlMap.entries()) {
          if (entryName === SHARED_STRINGS_PATH) {
            continue;
          }

          let nextXml = xml;

          if (WORKSHEET_PATH_PATTERN.test(entryName)) {
            let itemIndex = 0;
            nextXml = nextXml.replace(
              inlineStringPattern,
              (_full, openTag, innerXml, closeTag) => {
                const replacementText =
                  replacementLookup.get(
                    buildLookupKey("inline-string", entryName, itemIndex),
                  ) ?? decodeXml(extractTextFromXml(innerXml, textNodePattern));
                itemIndex += 1;
                return `${openTag}${replaceTextNodes(
                  innerXml,
                  replacementText,
                  textNodePattern,
                )}${closeTag}`;
              },
            );
          }

          if (COMMENTS_PATH_PATTERN.test(entryName)) {
            let itemIndex = 0;
            nextXml = nextXml.replace(commentItemPattern, (itemXml) => {
              const replacementText =
                replacementLookup.get(
                  buildLookupKey("comment", entryName, itemIndex),
                ) ?? decodeXml(extractTextFromXml(itemXml, textNodePattern));
              itemIndex += 1;
              return replaceTextNodes(itemXml, replacementText, textNodePattern);
            });
          }

          if (THREADED_COMMENTS_PATH_PATTERN.test(entryName)) {
            let itemIndex = 0;
            nextXml = nextXml.replace(threadedCommentItemPattern, (itemXml) => {
              const replacementText =
                replacementLookup.get(
                  buildLookupKey("threaded-comment", entryName, itemIndex),
                ) ?? decodeXml(extractTextFromXml(itemXml, threadedTextPattern));
              itemIndex += 1;
              return replaceTextNodes(
                itemXml,
                replacementText,
                threadedTextPattern,
              );
            });
          }

          if (DRAWING_PATH_PATTERN.test(entryName)) {
            let itemIndex = 0;
            nextXml = nextXml.replace(
              drawingTextBodyPattern,
              (_full, openTag, innerXml, closeTag) => {
                const replacementText =
                  replacementLookup.get(
                    buildLookupKey("drawing-text", entryName, itemIndex),
                  ) ??
                  decodeXml(extractTextFromXml(innerXml, drawingTextNodePattern));
                itemIndex += 1;
                return `${openTag}${replaceTextNodes(
                  innerXml,
                  replacementText,
                  drawingTextNodePattern,
                )}${closeTag}`;
              },
            );
          }

          if (CHART_PATH_PATTERN.test(entryName)) {
            let itemIndex = 0;
            nextXml = nextXml.replace(
              chartRichTextPattern,
              (_full, openTag, innerXml, closeTag) => {
                const replacementText =
                  replacementLookup.get(
                    buildLookupKey("chart-rich-text", entryName, itemIndex),
                  ) ??
                  decodeXml(extractTextFromXml(innerXml, drawingTextNodePattern));
                itemIndex += 1;
                return `${openTag}${replaceTextNodes(
                  innerXml,
                  replacementText,
                  drawingTextNodePattern,
                )}${closeTag}`;
              },
            );
          }

          zip.file(entryName, nextXml);
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
    segments: ExtractedSegment[],
    descriptors: SegmentDescriptor[],
    entryXmlMap: Map<string, string>,
  ) {
    const sharedStringsXml = await zip.file(SHARED_STRINGS_PATH)?.async("text");
    if (!sharedStringsXml) {
      return;
    }

    entryXmlMap.set(SHARED_STRINGS_PATH, sharedStringsXml);

    let itemIndex = 0;
    for (const match of sharedStringsXml.matchAll(sharedStringItemPattern)) {
      const itemXml = match[0] ?? "";
      const text = decodeXml(extractTextFromXml(itemXml, textNodePattern));
      this.pushDescriptor(
        {
          id: `sharedStrings#${itemIndex}`,
          entryName: SHARED_STRINGS_PATH,
          entryType: "shared-string",
          itemIndex,
          text,
        },
        segments,
        descriptors,
      );
      itemIndex += 1;
    }
  }

  private async collectWorksheetInlineStrings(
    zip: JSZip,
    segments: ExtractedSegment[],
    descriptors: SegmentDescriptor[],
    entryXmlMap: Map<string, string>,
  ) {
    const worksheetEntries = Object.values(zip.files).filter((entry) =>
      WORKSHEET_PATH_PATTERN.test(entry.name),
    );

    for (const entry of worksheetEntries) {
      const xml = await entry.async("text");
      entryXmlMap.set(entry.name, xml);

      let itemIndex = 0;
      for (const match of xml.matchAll(inlineStringPattern)) {
        const innerXml = match[2] ?? "";
        const text = decodeXml(extractTextFromXml(innerXml, textNodePattern));
        this.pushDescriptor(
          {
            id: `${entry.name}#inlineStr-${itemIndex}`,
            entryName: entry.name,
            entryType: "inline-string",
            itemIndex,
            text,
          },
          segments,
          descriptors,
        );
        itemIndex += 1;
      }
    }
  }

  private async collectCommentEntries(
    zip: JSZip,
    pathPattern: RegExp,
    itemPattern: RegExp,
    nodePattern: RegExp,
    entryType: SegmentDescriptor["entryType"],
    segments: ExtractedSegment[],
    descriptors: SegmentDescriptor[],
    entryXmlMap: Map<string, string>,
  ) {
    const entries = Object.values(zip.files).filter((entry) =>
      pathPattern.test(entry.name),
    );

    for (const entry of entries) {
      const xml = await entry.async("text");
      entryXmlMap.set(entry.name, xml);

      let itemIndex = 0;
      for (const match of xml.matchAll(itemPattern)) {
        const itemXml = match[0] ?? "";
        const text = decodeXml(extractTextFromXml(itemXml, nodePattern));
        this.pushDescriptor(
          {
            id: `${entry.name}#${entryType}-${itemIndex}`,
            entryName: entry.name,
            entryType,
            itemIndex,
            text,
          },
          segments,
          descriptors,
        );
        itemIndex += 1;
      }
    }
  }

  private async collectRichTextEntries(
    zip: JSZip,
    pathPattern: RegExp,
    itemPattern: RegExp,
    nodePattern: RegExp,
    entryType: SegmentDescriptor["entryType"],
    segments: ExtractedSegment[],
    descriptors: SegmentDescriptor[],
    entryXmlMap: Map<string, string>,
  ) {
    const entries = Object.values(zip.files).filter((entry) =>
      pathPattern.test(entry.name),
    );

    for (const entry of entries) {
      const xml = await entry.async("text");
      entryXmlMap.set(entry.name, xml);

      let itemIndex = 0;
      for (const match of xml.matchAll(itemPattern)) {
        const innerXml = match[2] ?? "";
        const text = decodeXml(extractTextFromXml(innerXml, nodePattern));
        if (text.trim().length === 0) {
          itemIndex += 1;
          continue;
        }

        this.pushDescriptor(
          {
            id: `${entry.name}#${entryType}-${itemIndex}`,
            entryName: entry.name,
            entryType,
            itemIndex,
            text,
          },
          segments,
          descriptors,
        );
        itemIndex += 1;
      }
    }
  }

  private pushDescriptor(
    descriptor: SegmentDescriptor,
    segments: ExtractedSegment[],
    descriptors: SegmentDescriptor[],
  ) {
    segments.push({
      id: descriptor.id,
      text: descriptor.text,
    });
    descriptors.push(descriptor);
  }
}

function extractTextFromXml(xml: string, nodePattern: RegExp) {
  return Array.from(xml.matchAll(nodePattern))
    .map((match) => match[2] ?? "")
    .join("");
}

function replaceTextNodes(
  xml: string,
  replacementText: string,
  nodePattern: RegExp,
) {
  let hasReplacedFirstNode = false;

  return xml.replace(nodePattern, (_full, openTag, _text, closeTag) => {
    if (!hasReplacedFirstNode) {
      hasReplacedFirstNode = true;
      return `${ensurePreserveWhitespaceAttribute(
        openTag,
        replacementText,
      )}${encodeXml(replacementText)}${closeTag}`;
    }

    return `${stripPreserveWhitespaceAttribute(openTag)}${closeTag}`;
  });
}

function ensurePreserveWhitespaceAttribute(openTag: string, value: string) {
  const shouldPreserve =
    value.trim() !== value || value.includes("\n") || value.includes("\t");

  if (!shouldPreserve) {
    return stripPreserveWhitespaceAttribute(openTag);
  }

  if (/\sxml:space=/.test(openTag)) {
    return openTag.replace(/\sxml:space="[^"]*"/, ' xml:space="preserve"');
  }

  return openTag.replace(/>$/, ' xml:space="preserve">');
}

function stripPreserveWhitespaceAttribute(openTag: string) {
  return openTag.replace(/\sxml:space="[^"]*"/, "");
}

function buildDescriptorKey(descriptor: SegmentDescriptor) {
  return buildLookupKey(
    descriptor.entryType,
    descriptor.entryName,
    descriptor.itemIndex,
  );
}

function buildLookupKey(
  entryType: SegmentDescriptor["entryType"],
  entryName: string,
  itemIndex: number,
) {
  return `${entryType}:${entryName}:${itemIndex}`;
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function encodeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
