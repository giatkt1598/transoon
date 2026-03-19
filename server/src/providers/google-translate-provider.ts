import translate from "google-translate-api-x";
import {
  RegisterTranslateProvider,
  TranslateProvider,
  type TranslateRequest,
  type TranslationResult,
} from "../translate-provider";

@RegisterTranslateProvider({
  name: "Google Translate",
  description: "Cloud-style machine translation via google-translate-api-x.",
})
export class GoogleTranslateProvider extends TranslateProvider {
  readonly name = "Google Translate";

  async translate(request: TranslateRequest): Promise<TranslationResult> {
    const normalizedSegments = request.segments.map((segment) => segment ?? "");
    const nonEmptySegments = normalizedSegments.filter((segment) => segment.trim().length > 0);

    if (request.sourceLanguage === request.targetLanguage || nonEmptySegments.length === 0) {
      return {
        translatedSegments: normalizedSegments,
        warnings: [],
        provider: this.name,
      };
    }

    const translatedMap = new Map<number, string>();
    const chunks = buildChunks(normalizedSegments);

    await request.onProgress?.({
      phase: "translating",
      totalChunks: chunks.length,
      completedChunks: 0,
      progressPercent: chunks.length === 0 ? 100 : 0,
      message:
        chunks.length === 0
          ? "No non-empty text chunks to translate."
          : `Translating chunk 1 of ${chunks.length}.`,
    });

    for (const [chunkIndex, chunk] of chunks.entries()) {
      const inputs = chunk.map((item) => item.text);
      const response = await translate(inputs, {
        from: request.sourceLanguage,
        to: request.targetLanguage,
        forceBatch: true,
      });

      response.forEach((result, index) => {
        translatedMap.set(chunk[index].index, result.text);
      });

      await request.onProgress?.({
        phase: "translating",
        totalChunks: chunks.length,
        completedChunks: chunkIndex + 1,
        progressPercent: Math.round(((chunkIndex + 1) / chunks.length) * 100),
        message:
          chunkIndex + 1 === chunks.length
            ? `Finished translating ${chunks.length} chunks.`
            : `Translating chunk ${chunkIndex + 2} of ${chunks.length}.`,
      });
    }

    return {
      translatedSegments: normalizedSegments.map(
        (segment, index) => translatedMap.get(index) ?? segment,
      ),
      warnings: [],
      provider: this.name,
    };
  }
}

function buildChunks(segments: string[]) {
  const chunks: Array<Array<{ index: number; text: string }>> = [];
  let currentChunk: Array<{ index: number; text: string }> = [];
  let currentLength = 0;

  segments.forEach((text, index) => {
    if (text.trim().length === 0) {
      return;
    }

    const nextLength = currentLength + text.length;
    if (currentChunk.length > 0 && nextLength > 4000) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentLength = 0;
    }

    currentChunk.push({ index, text });
    currentLength += text.length;
  });

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}
