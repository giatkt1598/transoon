import JSZip from "jszip";
import type { DocumentHandler, ExtractedDocument, ExtractedSegment } from "../document-types";

const DOCX_XML_PATHS = [
  /^word\/document\.xml$/,
  /^word\/header\d+\.xml$/,
  /^word\/footer\d+\.xml$/,
];

const textNodePattern = /(<w:t(?:\s+[^>]*)?>)([\s\S]*?)(<\/w:t>)/g;

export class DocxDocumentHandler implements DocumentHandler {
  readonly supportedExtensions = [".docx"];

  async extract(fileName: string, buffer: Buffer): Promise<ExtractedDocument> {
    const zip = await JSZip.loadAsync(buffer);
    const xmlEntries = Object.values(zip.files).filter((entry) =>
      DOCX_XML_PATHS.some((pattern) => pattern.test(entry.name)),
    );

    const xmlMap = new Map<string, string>();
    const segments: ExtractedSegment[] = [];

    for (const entry of xmlEntries) {
      const xml = await entry.async("text");
      xmlMap.set(entry.name, xml);

      let segmentIndex = 0;
      for (const match of xml.matchAll(textNodePattern)) {
        const rawText = match[2] ?? "";
        segments.push({
          id: `${entry.name}#${segmentIndex}`,
          text: decodeXml(rawText),
        });
        segmentIndex += 1;
      }
    }

    return {
      documentType: "docx",
      fileName,
      segments,
      replaceSegments: async (nextSegments: string[]) => {
        let replacementIndex = 0;

        for (const [entryName, xml] of Array.from(xmlMap.entries())) {
          const nextXml = xml.replace(
            textNodePattern,
            (_full, openTag, text, closeTag) => {
              const replacementText =
                nextSegments[replacementIndex] ?? decodeXml(text);
              replacementIndex += 1;
              return `${openTag}${encodeXml(replacementText)}${closeTag}`;
            },
          );

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
