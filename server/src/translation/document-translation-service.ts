import { appConfig } from "../config/app-config";
import { extractDocument, writeOutputFile } from "../document-service";
import { type TranslateProgress } from "../translate-provider";
import { translateSegments } from "../translation-service";

export type TranslateDocumentInput = {
  requestId: string;
  fileName: string;
  fileBuffer: Buffer;
  sourceLanguage: string;
  targetLanguage: string;
  providerName: string;
  onProgress?: (progress: TranslateProgress) => void | Promise<void>;
};

export type TranslateDocumentResult = {
  requestId: string;
  sourceLanguage: string;
  targetLanguage: string;
  providerName: string;
  documentType: "docx" | "txt" | "xlsx" | "pptx";
  originalFileName: string;
  outputFileName: string;
  provider: string;
  warnings: string[];
  segmentCount: number;
  processingTimeMs: number;
  preview: string[];
  downloadUrl: string;
};

export async function translateDocument(
  input: TranslateDocumentInput,
): Promise<TranslateDocumentResult> {
  const startedAt = performance.now();

  await input.onProgress?.({
    phase: "extracting",
    totalChunks: 0,
    completedChunks: 0,
    progressPercent: 5,
    message: "Extracting text from document.",
  });

  const extractedDocument = await extractDocument(input.fileName, input.fileBuffer);
  const { translatedSegments, warnings, provider } = await translateSegments(
    extractedDocument.segments.map((segment) => segment.text),
    input.sourceLanguage === "auto" ? "auto" : input.sourceLanguage,
    input.targetLanguage,
    input.providerName,
    (progress) =>
      input.onProgress?.({
        ...progress,
        progressPercent: Math.max(
          10,
          Math.min(90, Math.round(10 + progress.progressPercent * 0.8)),
        ),
      }),
  );

  await input.onProgress?.({
    phase: "merging",
    totalChunks: 0,
    completedChunks: 0,
    progressPercent: 92,
    message: "Merging translated text back into the document.",
  });

  const outputBuffer = await extractedDocument.replaceSegments(translatedSegments);
  const { outputFileName } = await writeOutputFile(input.fileName, outputBuffer);

  await input.onProgress?.({
    phase: "completed",
    totalChunks: 0,
    completedChunks: 0,
    progressPercent: 100,
    message: "Translation completed.",
  });

  return {
    requestId: input.requestId,
    sourceLanguage: input.sourceLanguage,
    targetLanguage: input.targetLanguage,
    providerName: input.providerName,
    documentType: extractedDocument.documentType,
    originalFileName: input.fileName,
    outputFileName,
    provider,
    warnings,
    segmentCount: extractedDocument.segments.length,
    processingTimeMs: Math.round(performance.now() - startedAt),
    preview: translatedSegments
      .filter((segment) => segment.trim().length > 0)
      .slice(0, 8),
    downloadUrl: `http://localhost:${appConfig.port}/api/downloads/${outputFileName}`,
  };
}
