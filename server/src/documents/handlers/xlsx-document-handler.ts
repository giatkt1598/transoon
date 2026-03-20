import JSZip from "jszip";
import type {
  DocumentHandler,
  ExtractedDocument,
  ExtractedSegment,
} from "../document-types";

const SHARED_STRINGS_PATH = "xl/sharedStrings.xml";
const WORKSHEET_PATH_PATTERN = /^xl\/worksheets\/sheet\d+\.xml$/;
const sharedStringItemPattern = /<si\b[^>]*>[\s\S]*?<\/si>/g;
const textNodePattern = /<t(?:\s+[^>]*)?>([\s\S]*?)<\/t>/g;
const inlineStringPattern =
  /(<c\b[^>]*\bt="inlineStr"[^>]*>[\s\S]*?<is\b[^>]*>)([\s\S]*?)(<\/is>[\s\S]*?<\/c>)/g;

type SharedStringEntry = {
  index: number;
  xml: string;
  text: string;
};

type InlineStringEntry = {
  entryName: string;
  index: number;
  text: string;
};

export class XlsxDocumentHandler implements DocumentHandler {
  readonly supportedExtensions = [".xlsx"];

  async extract(fileName: string, buffer: Buffer): Promise<ExtractedDocument> {
    const zip = await JSZip.loadAsync(buffer);
    const sharedStringsXml = await zip.file(SHARED_STRINGS_PATH)?.async("text");
    const worksheetEntries = Object.values(zip.files).filter((entry) =>
      WORKSHEET_PATH_PATTERN.test(entry.name),
    );

    const segments: ExtractedSegment[] = [];
    const sharedStrings = extractSharedStrings(sharedStringsXml);
    const worksheetXmlMap = new Map<string, string>();
    const inlineStrings: InlineStringEntry[] = [];

    sharedStrings.forEach((entry) => {
      segments.push({
        id: `sharedStrings#${entry.index}`,
        text: entry.text,
      });
    });

    for (const entry of worksheetEntries) {
      const xml = await entry.async("text");
      worksheetXmlMap.set(entry.name, xml);

      let inlineIndex = 0;
      for (const match of xml.matchAll(inlineStringPattern)) {
        const inlineText = decodeXml(extractTextFromXml(match[2] ?? ""));
        inlineStrings.push({
          entryName: entry.name,
          index: inlineIndex,
          text: inlineText,
        });
        segments.push({
          id: `${entry.name}#inlineStr-${inlineIndex}`,
          text: inlineText,
        });
        inlineIndex += 1;
      }
    }

    return {
      documentType: "xlsx",
      fileName,
      segments,
      replaceSegments: async (nextSegments: string[]) => {
        let replacementIndex = 0;

        if (sharedStringsXml) {
          let sharedReplacementIndex = 0;
          const nextSharedStringsXml = sharedStringsXml.replace(
            sharedStringItemPattern,
            () => {
              const replacementText =
                nextSegments[replacementIndex] ??
                sharedStrings[sharedReplacementIndex]?.text ??
                "";
              replacementIndex += 1;
              sharedReplacementIndex += 1;
              return buildSharedStringItem(replacementText);
            },
          );

          zip.file(SHARED_STRINGS_PATH, nextSharedStringsXml);
        }

        for (const [entryName, xml] of worksheetXmlMap.entries()) {
          let inlineIndex = 0;
          const nextWorksheetXml = xml.replace(
            inlineStringPattern,
            (_full, openTag, _inner, closeTag) => {
              const fallbackText =
                inlineStrings.find(
                  (item) =>
                    item.entryName === entryName && item.index === inlineIndex,
                )?.text ?? "";
              const replacementText =
                nextSegments[replacementIndex] ?? fallbackText;
              replacementIndex += 1;
              inlineIndex += 1;
              return `${openTag}${buildInlineStringContent(replacementText)}${closeTag}`;
            },
          );

          zip.file(entryName, nextWorksheetXml);
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

function extractSharedStrings(sharedStringsXml?: string) {
  if (!sharedStringsXml) {
    return [] as SharedStringEntry[];
  }

  return Array.from(sharedStringsXml.matchAll(sharedStringItemPattern)).map(
    (match, index) => {
      const xml = match[0] ?? "";
      return {
        index,
        xml,
        text: decodeXml(extractTextFromXml(xml)),
      };
    },
  );
}

function extractTextFromXml(xml: string) {
  return Array.from(xml.matchAll(textNodePattern))
    .map((match) => match[1] ?? "")
    .join("");
}

function buildSharedStringItem(text: string) {
  return `<si>${buildInlineStringContent(text)}</si>`;
}

function buildInlineStringContent(text: string) {
  const encodedText = encodeXml(text);
  const preserveWhitespace =
    text.trim() !== text || text.includes("\n") || text.includes("\t");
  const preserveAttribute = preserveWhitespace ? ' xml:space="preserve"' : "";

  return `<t${preserveAttribute}>${encodedText}</t>`;
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function encodeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
