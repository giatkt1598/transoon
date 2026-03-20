import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import JSZip from "jszip";

export type SupportedDocumentType = "docx" | "txt";

export type ExtractedSegment = {
  id: string;
  text: string;
};

export type ExtractedDocument = {
  documentType: SupportedDocumentType;
  fileName: string;
  segments: ExtractedSegment[];
  replaceSegments: (nextSegments: string[]) => Promise<Buffer>;
};

const DOCX_XML_PATHS = [
  /^word\/document\.xml$/,
  /^word\/header\d+\.xml$/,
  /^word\/footer\d+\.xml$/,
];

const textNodePattern = /(<w:t(?:\s+[^>]*)?>)([\s\S]*?)(<\/w:t>)/g;

export async function extractDocument(
  fileName: string,
  buffer: Buffer,
): Promise<ExtractedDocument> {
  const extension = path.extname(fileName).toLowerCase();

  if (extension === ".txt") {
    return extractTxtDocument(fileName, buffer);
  }

  if (extension === ".docx") {
    return extractDocxDocument(fileName, buffer);
  }

  throw new Error("Only .txt and .docx files are supported in this first version.");
}

export async function writeOutputFile(
  sourceFileName: string,
  buffer: Buffer,
): Promise<{ outputPath: string; outputFileName: string }> {
  const outputDirectory = path.resolve(process.cwd(), "storage", "outputs");
  await fs.mkdir(outputDirectory, { recursive: true });

  const extension = path.extname(sourceFileName);
  const baseName = path.basename(sourceFileName, extension);
  const outputFileName = `${baseName}.translated.${randomUUID()}${extension}`;
  const outputPath = path.join(outputDirectory, outputFileName);

  await fs.writeFile(outputPath, buffer);

  return { outputPath, outputFileName };
}

async function extractTxtDocument(
  fileName: string,
  buffer: Buffer,
): Promise<ExtractedDocument> {
  const text = buffer.toString("utf8");

  return {
    documentType: "txt",
    fileName,
    segments: [{ id: "txt-1", text }],
    replaceSegments: async (nextSegments: string[]) => {
      const [nextText = ""] = nextSegments;
      return Buffer.from(nextText, "utf8");
    },
  };
}

async function extractDocxDocument(
  fileName: string,
  buffer: Buffer,
): Promise<ExtractedDocument> {
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
        const nextXml = xml.replace(textNodePattern, (_full, openTag, text, closeTag) => {
          const replacementText = nextSegments[replacementIndex] ?? decodeXml(text);
          replacementIndex += 1;
          return `${openTag}${encodeXml(replacementText)}${closeTag}`;
        });

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
