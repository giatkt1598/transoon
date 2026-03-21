import path from "path";
import { CsvDocumentHandler } from "./handlers/csv-document-handler";
import { DocxDocumentHandler } from "./handlers/docx-document-handler";
import { PptxDocumentHandler } from "./handlers/pptx-document-handler";
import { TxtDocumentHandler } from "./handlers/txt-document-handler";
import { XlsxDocumentHandler } from "./handlers/xlsx-document-handler";
import type { DocumentHandler, ExtractedDocument } from "./document-types";

const registeredHandlers: DocumentHandler[] = [
  new CsvDocumentHandler(),
  new TxtDocumentHandler(),
  new DocxDocumentHandler(),
  new XlsxDocumentHandler(),
  new PptxDocumentHandler(),
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
      "Only .txt, .docx, .xlsx, .csv, and .pptx files are supported right now.",
    );
  }

  return handler.extract(fileName, buffer);
}
