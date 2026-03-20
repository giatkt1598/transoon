import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import JSZip from "jszip";
import type {
  DocumentHandler,
  ExtractedDocument,
  ExtractedSegment,
} from "../document-types";

const SLIDE_PATH_PATTERN = /^ppt\/slides\/slide\d+\.xml$/;
const NOTES_SLIDE_PATH_PATTERN = /^ppt\/notesSlides\/notesSlide\d+\.xml$/;
const COMMENT_PATH_PATTERN = /^ppt\/comments\/comment\d+\.xml$/;
const CHART_PATH_PATTERN = /^ppt\/charts\/chart\d+\.xml$/;

const parser = new DOMParser();
const serializer = new XMLSerializer();

type TextNodeDescriptor = {
  id: string;
  entryName: string;
  textNodeIndex: number;
  text: string;
};

export class PptxDocumentHandler implements DocumentHandler {
  readonly supportedExtensions = [".pptx"];

  async extract(fileName: string, buffer: Buffer): Promise<ExtractedDocument> {
    const zip = await JSZip.loadAsync(buffer);
    const entryNames = Object.values(zip.files)
      .filter((entry) =>
        SLIDE_PATH_PATTERN.test(entry.name) ||
        NOTES_SLIDE_PATH_PATTERN.test(entry.name) ||
        COMMENT_PATH_PATTERN.test(entry.name) ||
        CHART_PATH_PATTERN.test(entry.name),
      )
      .map((entry) => entry.name);

    const entryXmlMap = new Map<string, string>();
    const descriptors: TextNodeDescriptor[] = [];

    for (const entryName of entryNames) {
      const xml = await zip.file(entryName)?.async("text");
      if (!xml) {
        continue;
      }

      entryXmlMap.set(entryName, xml);
      const document = parseXml(xml);
      const textNodes = findElementsByLocalName(document, ["t"]);

      textNodes.forEach((textNode, textNodeIndex) => {
        const text = normalizeText(textNode.textContent ?? "");
        if (text.trim().length === 0) {
          return;
        }

        descriptors.push({
          id: `${entryName}#text-${textNodeIndex}`,
          entryName,
          textNodeIndex,
          text,
        });
      });
    }

    return {
      documentType: "pptx",
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
          const textNodes = findElementsByLocalName(document, ["t"]);

          textNodes.forEach((textNode, textNodeIndex) => {
            const replacementText = replacementLookup.get(
              buildDescriptorKey({
                entryName,
                textNodeIndex,
              }),
            );

            if (replacementText === undefined) {
              return;
            }

            setElementText(textNode, replacementText);
          });

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

function buildDescriptorKey(descriptor: Pick<TextNodeDescriptor, "entryName" | "textNodeIndex">) {
  return `${descriptor.entryName}:${descriptor.textNodeIndex}`;
}
