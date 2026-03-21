import { XMLSerializer } from "@xmldom/xmldom";
import JSZip from "jszip";
import {
  applyDocxBlockText,
  buildDocxEntryPlan,
  type DocxEntryPlan,
  rebuildDocxBlockText,
} from "../docx-segmentation";
import type { DocumentHandler, ExtractedDocument } from "../document-types";

const DOCX_XML_PATHS = [
  /^word\/document\.xml$/u,
  /^word\/header\d+\.xml$/u,
  /^word\/footer\d+\.xml$/u,
];

const serializer = new XMLSerializer();

export class DocxDocumentHandler implements DocumentHandler {
  readonly supportedExtensions = [".docx"];

  async extract(fileName: string, buffer: Buffer): Promise<ExtractedDocument> {
    const zip = await JSZip.loadAsync(buffer);
    const xmlEntries = Object.values(zip.files).filter((entry) =>
      DOCX_XML_PATHS.some((pattern) => pattern.test(entry.name)),
    );
    const entryPlans: Array<{ entryName: string; plan: DocxEntryPlan }> = [];

    for (const entry of xmlEntries) {
      const xml = await entry.async("text");
      entryPlans.push({
        entryName: entry.name,
        plan: buildDocxEntryPlan(entry.name, xml),
      });
    }

    const segments = entryPlans.flatMap((entry) => entry.plan.segments);

    return {
      documentType: "docx",
      fileName,
      segments,
      replaceSegments: async (nextSegments: string[]) => {
        let replacementIndex = 0;

        for (const entry of entryPlans) {
          for (const block of entry.plan.blocks) {
            const replacementTexts = block.segmentTexts.map((segmentText: string) => {
              const nextText = nextSegments[replacementIndex] ?? segmentText;
              replacementIndex += 1;
              return nextText;
            });
            const rebuiltText = rebuildDocxBlockText(block, replacementTexts);
            applyDocxBlockText(block, rebuiltText);
          }

          zip.file(entry.entryName, serializer.serializeToString(entry.plan.document));
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
