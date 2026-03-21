import { DOMParser } from "@xmldom/xmldom";
import JSZip from "jszip";
import mammoth from "mammoth";

export type DocxPreviewBlock = {
  blockId: string;
  segmentIds: string[];
  kind: "paragraph" | "table";
};

export type DocxPreviewDocument = {
  documentType: "docx";
  fileName: string;
  html: string;
  blocks: DocxPreviewBlock[];
};

const parser = new DOMParser();
const DOCX_BODY_PATH = "word/document.xml";

export async function buildDocxPreviewDocument(
  fileName: string,
  buffer: Buffer,
): Promise<DocxPreviewDocument> {
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file(DOCX_BODY_PATH)?.async("text");

  if (!documentXml) {
    throw new Error("The DOCX file is missing word/document.xml.");
  }

  const htmlResult = await mammoth.convertToHtml(
    { buffer },
    {
      includeDefaultStyleMap: true,
    },
  );

  return {
    documentType: "docx",
    fileName,
    html: htmlResult.value,
    blocks: collectDocxPreviewBlocks(documentXml),
  };
}

function collectDocxPreviewBlocks(documentXml: string) {
  const document = parser.parseFromString(documentXml, "application/xml");
  const body = findFirstElementByLocalName(document, "body");

  if (!body) {
    return [];
  }

  const blocks: DocxPreviewBlock[] = [];
  const segmentCounter = { value: 0 };
  let blockIndex = 0;

  for (const childNode of Array.from(body.childNodes)) {
    if (childNode.nodeType !== childNode.ELEMENT_NODE) {
      continue;
    }

    const childElement = childNode as Element;
    const localName = getLocalName(childElement);

    if (localName === "p") {
      blocks.push({
        blockId: `docx-block-${blockIndex}`,
        kind: "paragraph",
        segmentIds: collectSegmentIds(childElement, DOCX_BODY_PATH, segmentCounter),
      });
      blockIndex += 1;
      continue;
    }

    if (localName === "tbl") {
      blocks.push({
        blockId: `docx-block-${blockIndex}`,
        kind: "table",
        segmentIds: collectSegmentIds(childElement, DOCX_BODY_PATH, segmentCounter),
      });
      blockIndex += 1;
    }
  }

  return blocks;
}

function collectSegmentIds(
  root: Element,
  entryName: string,
  segmentCounter: { value: number },
) {
  return findDescendantElementsByLocalName(root, "t").map(() => {
    const segmentId = `${entryName}#${segmentCounter.value}`;
    segmentCounter.value += 1;
    return segmentId;
  });
}

function findFirstElementByLocalName(document: Document, localName: string) {
  return findDescendantElementsByLocalName(document, localName)[0] ?? null;
}

function findDescendantElementsByLocalName(
  root: Document | Element,
  localName: string,
) {
  const matches: Element[] = [];

  walkElements(root, (element) => {
    if (getLocalName(element) === localName) {
      matches.push(element);
    }
  });

  return matches;
}

function walkElements(root: Document | Element, visitor: (element: Element) => void) {
  const childNodes = Array.from(root.childNodes);

  for (const childNode of childNodes) {
    if (childNode.nodeType !== childNode.ELEMENT_NODE) {
      continue;
    }

    const childElement = childNode as Element;
    visitor(childElement);
    walkElements(childElement, visitor);
  }
}

function getLocalName(element: Element) {
  return element.localName ?? element.nodeName.replace(/^.*:/, "");
}
