import JSZip from "jszip";
import { Log } from "../../logger";
import {
  applyXlsxExtractionPlan,
  buildXlsxExtractionPlan,
} from "../xlsx-segmentation";
import type { DocumentHandler, ExtractedDocument } from "../document-types";

export class XlsxDocumentHandler implements DocumentHandler {
  readonly supportedExtensions = [".xlsx"];

  async extract(fileName: string, buffer: Buffer): Promise<ExtractedDocument> {
    const zip = await JSZip.loadAsync(buffer);
    const logger = Log.forContext({
      documentHandler: "xlsx",
      fileName,
    });
    const plan = await buildXlsxExtractionPlan(zip, logger);

    return {
      documentType: "xlsx",
      fileName,
      segments: plan.segments,
      replaceSegments: async (nextSegments: string[]) =>
        applyXlsxExtractionPlan(zip, plan, nextSegments, logger),
    };
  }
}
