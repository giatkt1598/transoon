export type SupportedDocumentType = "docx" | "txt" | "xlsx" | "pptx";

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

export interface DocumentHandler {
  readonly supportedExtensions: string[];
  extract(fileName: string, buffer: Buffer): Promise<ExtractedDocument>;
}
