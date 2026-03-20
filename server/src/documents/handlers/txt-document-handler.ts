import type { DocumentHandler, ExtractedDocument } from "../document-types";

export class TxtDocumentHandler implements DocumentHandler {
  readonly supportedExtensions = [".txt"];

  async extract(fileName: string, buffer: Buffer): Promise<ExtractedDocument> {
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
}
