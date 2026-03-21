import JSZip from "jszip";
import mammoth from "mammoth";
import {
  buildDocxEntryPlan,
  type DocxPreviewBlock,
} from "./docx-segmentation";

export type DocxPreviewDocument = {
  documentType: "docx";
  fileName: string;
  html: string;
  blocks: DocxPreviewBlock[];
};

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
  const plan = buildDocxEntryPlan(DOCX_BODY_PATH, documentXml);

  return {
    documentType: "docx",
    fileName,
    html: htmlResult.value,
    blocks: plan.previewBlocks,
  };
}
