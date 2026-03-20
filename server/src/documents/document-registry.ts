import path from "path";
import { DocxDocumentHandler } from "./handlers/docx-document-handler";
import { TxtDocumentHandler } from "./handlers/txt-document-handler";
import { XlsxDocumentHandler } from "./handlers/xlsx-document-handler";
import type { DocumentHandler, ExtractedDocument } from "./document-types";

const registeredHandlers: DocumentHandler[] = [
  new TxtDocumentHandler(),
  new DocxDocumentHandler(),
  new XlsxDocumentHandler(),
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
      "Only .txt, .docx, and .xlsx files are supported right now. The server is structured so .pptx can be added next.",
    );
  }

  return handler.extract(fileName, buffer);
}
