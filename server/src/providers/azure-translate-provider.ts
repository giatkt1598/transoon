import { randomUUID } from "crypto";
import {
  RegisterTranslateProvider,
  TranslateProvider,
  type TranslateRequest,
  type TranslationResult,
} from "../translate-provider";

type AzureTranslateResponseItem = {
  translations?: Array<{
    text?: string;
    to?: string;
  }>;
};

@RegisterTranslateProvider({
  name: "Azure Translate Provider",
  description: "HTTP-based Azure Translator provider wired to the local Azure Translate API mock.",
})
export class AzureTranslateProvider extends TranslateProvider {
  readonly name = "Azure Translate Provider";

  private readonly endpoint =
    process.env.AZURE_TRANSLATE_API_BASE_URL ?? "http://127.0.0.1:3201";
  private readonly apiKey =
    process.env.AZURE_TRANSLATE_API_KEY ?? "mock-subscription-key";
  private readonly region =
    process.env.AZURE_TRANSLATE_API_REGION ?? "southeastasia";
  private readonly apiVersion = "3.0";
  private readonly batchSize = Number(
    process.env.AZURE_TRANSLATE_BATCH_SIZE ?? 50,
  );

  async translate(request: TranslateRequest): Promise<TranslationResult> {
    const normalizedSegments = request.segments.map((segment) => segment ?? "");
    const nonEmptySegments = normalizedSegments
      .map((text, index) => ({ index, text }))
      .filter((segment) => segment.text.trim().length > 0);
    const totalSegments = nonEmptySegments.length;

    if (request.sourceLanguage === request.targetLanguage || totalSegments === 0) {
      return {
        translatedSegments: normalizedSegments,
        warnings: [],
        provider: this.name,
      };
    }

    const translatedMap = new Map<number, string>();
    const batches = chunkSegments(nonEmptySegments, this.batchSize);

    await request.onProgress?.({
      phase: "translating",
      totalChunks: totalSegments,
      completedChunks: 0,
      progressPercent: 0,
      message: `Translated 0 of ${totalSegments} segments.`,
    });

    for (const batch of batches) {
      throwIfAborted(request.signal);
      const translatedBatch = await this.translateBatch(
        batch,
        request.sourceLanguage,
        request.targetLanguage,
        request.signal,
      );

      translatedBatch.forEach((item) => {
        translatedMap.set(item.index, item.text);
      });

      await request.onTranslatedSegments?.(translatedBatch);
      await request.onProgress?.({
        phase: "translating",
        totalChunks: totalSegments,
        completedChunks: translatedMap.size,
        progressPercent:
          totalSegments === 0
            ? 100
            : Math.round((translatedMap.size / totalSegments) * 100),
        message: `Translated ${translatedMap.size} of ${totalSegments} segments.`,
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

  private async translateBatch(
    batch: Array<{ index: number; text: string }>,
    sourceLanguage: string,
    targetLanguage: string,
    signal?: AbortSignal,
  ) {
    const url = new URL("/translate", ensureTrailingSlash(this.endpoint));
    url.searchParams.set("api-version", this.apiVersion);
    url.searchParams.set("to", targetLanguage);
    if (sourceLanguage !== "auto") {
      url.searchParams.set("from", sourceLanguage);
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        "Ocp-Apim-Subscription-Key": this.apiKey,
        "Ocp-Apim-Subscription-Region": this.region,
        "X-ClientTraceId": randomUUID(),
      },
      body: JSON.stringify(batch.map((item) => ({ Text: item.text }))),
      signal,
    });

    const data = (await response.json()) as
      | AzureTranslateResponseItem[]
      | { error?: { message?: string } };

    if (!response.ok || !Array.isArray(data)) {
      throw new Error(
        !Array.isArray(data) && data.error?.message
          ? data.error.message
          : `Azure Translate Provider request failed with status ${response.status}.`,
      );
    }

    if (data.length !== batch.length) {
      throw new Error(
        `Azure Translate Provider returned ${data.length} items, expected ${batch.length}.`,
      );
    }

    return batch.map((item, index) => ({
      index: item.index,
      text: data[index]?.translations?.[0]?.text ?? item.text,
    }));
  }
}

function chunkSegments<T>(items: T[], batchSize: number) {
  const nextBatchSize = Math.max(1, batchSize);
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += nextBatchSize) {
    chunks.push(items.slice(index, index + nextBatchSize));
  }

  return chunks;
}

function ensureTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new Error("Auto translate was cancelled.");
  }
}
