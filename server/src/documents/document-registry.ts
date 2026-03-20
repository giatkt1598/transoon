import path from "path";
import { DocxDocumentHandler } from "./handlers/docx-document-handler";
import { TxtDocumentHandler } from "./handlers/txt-document-handler";
import type { DocumentHandler, ExtractedDocument } from "./document-types";

const registeredHandlers: DocumentHandler[] = [
  new TxtDocumentHandler(),
  new DocxDocumentHandler(),
];

export async function extractDocument(
  fileName: string,
  buffer: Buffer,
): Promise<ExtractedDocument> {
  const extension = path.extname(fileName).toLowerCase();
  const handler = registeredHandlers.find((entry) =>
    entry.supportedExtensions.includes(extension),
  );

  if (!handler) {
    throw new Error(
      "Only .txt and .docx files are supported right now. The server is structured so .xlsx and .pptx handlers can be added next.",
    );
  }

  return handler.extract(fileName, buffer);
}
