import { Log } from "../logger";
import {
  TranslateProvider,
  type TranslatePromptContext,
  type TranslateRequest,
  type TranslatePromptPreview,
  type TranslationResult,
} from "../translate-provider";

type AIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ParsedTranslation = {
  translatedSegments?: Array<{ index: number; text: string }>;
};

type ChunkTranslationResult = {
  translatedSegments: Array<{ index: number; text: string }>;
  lastError?: string;
};

export abstract class AITranslateProvider extends TranslateProvider {
  protected readonly endpoint = process.env.OLLAMA_API_URL ?? "http://127.0.0.1:11434/api/chat";
  protected readonly timeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS ?? 180000);
  protected readonly maxRetries = Number(process.env.AI_TRANSLATE_MAX_RETRIES ?? 3);
  protected readonly retryDelayMs = Number(process.env.AI_TRANSLATE_RETRY_DELAY_MS ?? 1000);
  protected readonly recoveryAttempts = Number(process.env.AI_TRANSLATE_RECOVERY_ATTEMPTS ?? 3);
  protected readonly systemPrompt =
    "You are a translation engine. Return JSON only. Do not add explanations. Keep the same number of items and preserve placeholders, whitespace, and line breaks as closely as possible.";

  protected abstract readonly model: string;
  protected abstract readonly chunkSize: number;
  protected abstract extractContent(data: unknown): string | undefined;

  async translate(request: TranslateRequest): Promise<TranslationResult> {
    const logger = Log.forContext({
      provider: this.name,
      model: this.model,
      endpoint: this.endpoint,
      sourceLanguage: request.sourceLanguage,
      targetLanguage: request.targetLanguage,
    });

    const normalizedSegments = request.segments.map((segment) => segment ?? "");
    const translatableSegments = normalizedSegments
      .map((text, index) => ({ index, text }))
      .filter((segment) => segment.text.trim().length > 0);
    const totalSegments = translatableSegments.length;

    if (request.sourceLanguage === request.targetLanguage || totalSegments === 0) {
      return {
        translatedSegments: normalizedSegments,
        warnings: [],
        provider: this.name,
      };
    }

    const translatedMap = new Map<number, string>();
    const deferredSegments: Array<{ index: number; text: string }> = [];
    const warnings: string[] = [];
    const chunks = this.buildChunks(normalizedSegments);

    await this.reportSegmentProgress(request, translatedMap.size, totalSegments);

    for (const [chunkIndex, chunk] of chunks.entries()) {
      throwIfAborted(request.signal);
      const payload = chunk.map((item) => ({
        index: item.index,
        text: item.text,
      }));

      const result = await this.translateChunkWithRetry(
        logger,
        chunkIndex,
        payload,
        request.sourceLanguage,
        request.targetLanguage,
        request.signal,
        request.promptMode,
        request.buildPromptOverride,
      );

      result.translatedSegments.forEach((item) => {
        translatedMap.set(item.index, item.text);
      });
      await request.onTranslatedSegments?.(result.translatedSegments);

      const translatedIndexes = new Set(result.translatedSegments.map((item) => item.index));
      const unresolvedChunkSegments = payload.filter((item) => !translatedIndexes.has(item.index));

      if (unresolvedChunkSegments.length > 0) {
        deferredSegments.push(...unresolvedChunkSegments);
        await logger.warning("Deferring untranslated segments for {provider}", {
          chunkIndex,
          deferredSegmentCount: unresolvedChunkSegments.length,
          error: result.lastError ?? `${this.name} returned a partial translation for chunk ${chunkIndex}.`,
        });
      }

      await this.reportSegmentProgress(request, translatedMap.size, totalSegments);
    }

    const unresolvedSegments = dedupeSegments(deferredSegments.filter((segment) => !translatedMap.has(segment.index)));

    if (unresolvedSegments.length > 0) {
      await logger.warning("Retrying deferred segments for {provider}", {
        deferredSegmentCount: unresolvedSegments.length,
        recoveryAttempts: this.recoveryAttempts,
      });

      for (const segment of unresolvedSegments) {
        try {
          throwIfAborted(request.signal);
          const recovery = await this.translateChunkWithRetry(
            logger,
            "recovery",
            [segment],
            request.sourceLanguage,
            request.targetLanguage,
            request.signal,
            request.promptMode,
            request.buildPromptOverride,
            this.recoveryAttempts,
          );

          recovery.translatedSegments.forEach((item) => {
            translatedMap.set(item.index, item.text);
          });
          await request.onTranslatedSegments?.(recovery.translatedSegments);
        } catch (error) {
          warnings.push(
            `Segment ${segment.index} could not be translated after ${this.recoveryAttempts} recovery attempts. The original text was kept.`,
          );
          await logger.warning("Recovery translation failed for {provider}", {
            segmentIndex: segment.index,
            error: error instanceof Error ? error.message : String(error),
          });
        }

        await this.reportSegmentProgress(request, translatedMap.size, totalSegments);
      }
    }

    return {
      translatedSegments: normalizedSegments.map((segment, index) => translatedMap.get(index) ?? segment),
      warnings,
      provider: this.name,
    };
  }

  getPromptPreview(request: TranslateRequest): TranslatePromptPreview {
    const chunks = this.buildChunks(request.segments.map((segment) => segment ?? ""));
    const firstChunk = chunks[0];

    if (!firstChunk || firstChunk.length === 0) {
      return {
        supported: true,
        content: null,
      };
    }

    return {
      supported: true,
      content: this.resolvePrompt(
        request,
        firstChunk.map((segment) => ({
          index: segment.index,
          text: segment.text,
        })),
        request.sourceLanguage,
        request.targetLanguage,
      ),
    };
  }

  protected buildMessages(
    request: TranslateRequest,
    segments: Array<{ index: number; text: string }>,
    sourceLanguage: string,
    targetLanguage: string,
  ): AIMessage[] {
    if (request.promptMode === "inline") {
      return this.buildMessagesForInline(request, segments, sourceLanguage, targetLanguage);
    }

    return [
      {
        role: "system",
        content: this.systemPrompt,
      },
      {
        role: "user",
        content: this.resolvePrompt(request, segments, sourceLanguage, targetLanguage),
      },
    ];
  }

  protected buildMessagesForInline(
    request: TranslateRequest,
    segments: Array<{ index: number; text: string }>,
    sourceLanguage: string,
    targetLanguage: string,
  ): AIMessage[] {
    return [
      {
        role: "system",
        content: this.systemPrompt,
      },
      {
        role: "user",
        content: this.resolvePrompt(request, segments, sourceLanguage, targetLanguage),
      },
    ];
  }

  protected buildPrompt(
    segments: Array<{ index: number; text: string }>,
    sourceLanguage: string,
    targetLanguage: string,
  ) {
    const sourceLanguageName = normalizeLanguageName(sourceLanguage);
    const targetLanguageName = normalizeLanguageName(targetLanguage);

    return [
      `Translate each segment from ${sourceLanguageName} to ${targetLanguageName}.`,
      `You must return exactly ${segments.length} items inside translatedSegments.`,
      "Return strict JSON only.",
      "Output schema:",
      '{"translatedSegments":[{"index":number,"text":"string"}]}',
      "Segments:",
      JSON.stringify(segments),
    ].join("\n");
  }

  protected buildPromptInline(context: TranslatePromptContext) {
    return this.buildPrompt(
      context.segments.map((segment, index) => ({
        index,
        text: segment,
      })),
      context.sourceLanguage,
      context.targetLanguage,
    );
  }

  protected resolvePrompt(
    request: TranslateRequest,
    segments: Array<{ index: number; text: string }>,
    sourceLanguage: string,
    targetLanguage: string,
  ) {
    const promptContext: TranslatePromptContext = {
      segments: segments.map((segment) => segment.text),
      sourceLanguage,
      targetLanguage,
    };

    if (request.buildPromptOverride) {
      return request.buildPromptOverride(promptContext);
    }

    if (request.promptMode === "inline") {
      return this.buildPromptInline(promptContext);
    }

    return this.buildPrompt(segments, sourceLanguage, targetLanguage);
  }

  protected buildChunks(segments: string[]) {
    const chunks: Array<Array<{ index: number; text: string }>> = [];
    let currentChunk: Array<{ index: number; text: string }> = [];
    let currentLength = 0;

    segments.forEach((text, index) => {
      if (text.trim().length === 0) {
        return;
      }

      const nextLength = currentLength + text.length;
      if (currentChunk.length > 0 && nextLength > this.chunkSize) {
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

  protected parseTranslatedSegments(content: string) {
    const jsonText = extractJsonObject(content);
    return JSON.parse(jsonText) as ParsedTranslation;
  }

  private async reportSegmentProgress(
    request: TranslateRequest,
    translatedSegmentCount: number,
    totalSegments: number,
  ) {
    await request.onProgress?.({
      phase: "translating",
      totalChunks: totalSegments,
      completedChunks: translatedSegmentCount,
      progressPercent: totalSegments === 0 ? 100 : Math.round((translatedSegmentCount / totalSegments) * 100),
      message: `Translated ${translatedSegmentCount} of ${totalSegments} segments.`,
    });
  }

  private async translateChunkWithRetry(
    logger: ReturnType<typeof Log.forContext>,
    chunkIndex: number | "recovery",
    payload: Array<{ index: number; text: string }>,
    sourceLanguage: string,
    targetLanguage: string,
    signal: AbortSignal | undefined,
    promptMode: TranslateRequest["promptMode"],
    buildPromptOverride: TranslateRequest["buildPromptOverride"],
    maxAttempts = this.maxRetries + 1,
  ): Promise<ChunkTranslationResult> {
    let lastError: Error | null = null;
    const translatedMap = new Map<number, string>();

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      throwIfAborted(signal);
      const messages = this.buildMessages(
        {
          segments: payload.map((item) => item.text),
          sourceLanguage,
          targetLanguage,
          signal,
          promptMode,
          buildPromptOverride,
        },
        payload,
        sourceLanguage,
        targetLanguage,
      );

      try {
        await logger.information("Sending translation prompt to {provider}", {
          chunkIndex,
          attempt,
          maxAttempts,
          messages,
          payload,
        });

        const response = await this.requestOllama(messages, signal);

        if (!response.ok) {
          throw new Error(`${this.name} request failed with status ${response.status}.`);
        }

        const data = await response.json();
        await logger.information("Received raw response from {provider}", {
          chunkIndex,
          attempt,
          response: data,
        });

        const content = this.extractContent(data);
        if (!content) {
          throw new Error(`${this.name} returned an empty completion.`);
        }

        const validTranslatedSegments = this.parseResponseSegments(content, payload, promptMode);

        if (validTranslatedSegments.length === 0) {
          throw new Error(`${this.name} did not return any valid translated segments.`);
        }

        validTranslatedSegments.forEach((item) => {
          translatedMap.set(item.index, item.text);
        });

        if (translatedMap.size === payload.length) {
          if (attempt > 1) {
            await logger.information("Translation chunk {chunkIndex} succeeded after retry", {
              chunkIndex,
              attempt,
            });
          }

          return {
            translatedSegments: payload.map((item) => ({
              index: item.index,
              text: translatedMap.get(item.index) ?? item.text,
            })),
          };
        }

        throw new Error(`${this.name} returned ${translatedMap.size} translated segments, expected ${payload.length}.`);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const willRetry = attempt < maxAttempts;

        await logger.warning("Translation chunk attempt failed for {provider}", {
          chunkIndex,
          attempt,
          maxAttempts,
          willRetry,
          translatedSegmentCount: translatedMap.size,
          error: lastError.message,
        });

        if (!willRetry) {
          break;
        }

        await delay(this.retryDelayMs * attempt);
      }
    }

    if (translatedMap.size > 0) {
      return {
        translatedSegments: payload
          .filter((item) => translatedMap.has(item.index))
          .map((item) => ({
            index: item.index,
            text: translatedMap.get(item.index) ?? item.text,
          })),
        lastError: lastError?.message,
      };
    }

    throw new Error(
      `${this.name} failed to translate chunk ${chunkIndex} after ${maxAttempts} attempts. Last error: ${lastError?.message ?? "Unknown error"}.`,
    );
  }

  private extractValidTranslatedSegments(parsed: ParsedTranslation, payload: Array<{ index: number; text: string }>) {
    if (!parsed.translatedSegments || parsed.translatedSegments.length === 0) {
      return [];
    }

    const allowedIndexes = new Set(payload.map((item) => item.index));
    const translatedMap = new Map<number, string>();

    parsed.translatedSegments.forEach((item) => {
      if (typeof item.index === "number" && typeof item.text === "string" && allowedIndexes.has(item.index)) {
        translatedMap.set(item.index, item.text);
      }
    });

    return payload
      .filter((item) => translatedMap.has(item.index))
      .map((item) => ({
        index: item.index,
        text: translatedMap.get(item.index) ?? item.text,
      }));
  }

  private parseResponseSegments(
    content: string,
    payload: Array<{ index: number; text: string }>,
    promptMode: TranslateRequest["promptMode"],
  ) {
    try {
      const parsed = this.parseTranslatedSegments(content);
      return this.extractValidTranslatedSegments(parsed, payload);
    } catch (error) {
      if (promptMode === "inline" && payload.length === 1) {
        const plainText = extractPlainTextResponse(content);
        if (plainText.length > 0) {
          return [
            {
              index: payload[0].index,
              text: plainText,
            },
          ];
        }
      }

      throw error;
    }
  }

  private async requestOllama(messages: AIMessage[], signal?: AbortSignal) {
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), this.timeoutMs);
    const requestSignal =
      signal && typeof AbortSignal.any === "function"
        ? AbortSignal.any([abortController.signal, signal])
        : (signal ?? abortController.signal);

    try {
      return await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          stream: false,
        }),
        signal: requestSignal,
      });
    } catch (error) {
      throw createNetworkError(error, this.endpoint, this.model, this.timeoutMs, this.name);
    } finally {
      clearTimeout(timeout);
    }
  }
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new Error("Auto translate was cancelled.");
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function dedupeSegments(segments: Array<{ index: number; text: string }>) {
  const uniqueSegments = new Map<number, { index: number; text: string }>();

  segments.forEach((segment) => {
    if (!uniqueSegments.has(segment.index)) {
      uniqueSegments.set(segment.index, segment);
    }
  });

  return Array.from(uniqueSegments.values());
}

function extractJsonObject(content: string) {
  const fencedMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1]?.trim() ?? content.trim();

  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
    throw new Error("Model response did not contain a JSON object.");
  }

  return candidate.slice(firstBrace, lastBrace + 1);
}

function extractPlainTextResponse(content: string) {
  const trimmed = content.trim();
  const fencedMatch = trimmed.match(/```(?:\w+)?\s*([\s\S]*?)```/i);
  return (fencedMatch?.[1] ?? trimmed).trim();
}

export function normalizeLanguageName(languageCode: string) {
  const languageMap: Record<string, string> = {
    auto: "the detected source language",
    en: "English",
    vi: "Vietnamese",
    ja: "Japanese",
    ko: "Korean",
    fr: "French",
    de: "German",
    es: "Spanish",
    "zh-CN": "Simplified Chinese",
  };

  return languageMap[languageCode] ?? languageCode;
}

function createNetworkError(error: unknown, endpoint: string, model: string, timeoutMs: number, providerName: string) {
  if (error instanceof Error && error.name === "AbortError") {
    return new Error(
      `${providerName} request timed out after ${timeoutMs} ms. Ollama endpoint: ${endpoint}. Model: ${model}.`,
    );
  }

  const details = error instanceof Error ? error.message : String(error);
  return new Error(
    `Could not reach Ollama at ${endpoint} for model ${model}. Details: ${details}. ` +
      "If Ollama is running locally, prefer 127.0.0.1 over localhost on Windows.",
  );
}
