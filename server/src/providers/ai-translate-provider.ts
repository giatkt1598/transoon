import { Log } from "../logger";
import {
  TranslateProvider,
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

export abstract class AITranslateProvider extends TranslateProvider {
  protected readonly endpoint =
    process.env.OLLAMA_API_URL ?? "http://127.0.0.1:11434/api/chat";
  protected readonly timeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS ?? 180000);
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
    const nonEmptySegments = normalizedSegments.filter((segment) => segment.trim().length > 0);

    if (request.sourceLanguage === request.targetLanguage || nonEmptySegments.length === 0) {
      return {
        translatedSegments: normalizedSegments,
        warnings: [],
        provider: this.name,
      };
    }

    const translatedMap = new Map<number, string>();
    const chunks = this.buildChunks(normalizedSegments);

    for (const [chunkIndex, chunk] of chunks.entries()) {
      const payload = chunk.map((item) => ({
        index: item.index,
        text: item.text,
      }));
      const messages = this.buildMessages(
        payload,
        request.sourceLanguage,
        request.targetLanguage,
      );

      await logger.information("Sending translation prompt to {provider}", {
        chunkIndex,
        messages,
        payload,
      });

      const response = await this.requestOllama(messages);

      if (!response.ok) {
        throw new Error(`${this.name} request failed with status ${response.status}.`);
      }

      const data = await response.json();
      await logger.information("Received raw response from {provider}", {
        chunkIndex,
        response: data,
      });

      const content = this.extractContent(data);
      if (!content) {
        throw new Error(`${this.name} returned an empty completion.`);
      }

      const parsed = this.parseTranslatedSegments(content);
      if (!parsed.translatedSegments || parsed.translatedSegments.length === 0) {
        throw new Error(`${this.name} did not return any translated segments.`);
      }
      if (parsed.translatedSegments.length !== payload.length) {
        throw new Error(
          `${this.name} returned ${parsed.translatedSegments.length} translated segments, expected ${payload.length}.`,
        );
      }

      parsed.translatedSegments.forEach((item) => {
        translatedMap.set(item.index, item.text);
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

  getPromptPreview(request: Omit<TranslateRequest, "segments">): TranslatePromptPreview {
    return {
      supported: true,
      content: this.buildPrompt(
        [
          { index: 0, text: "First sample segment." },
          { index: 1, text: "Second sample segment with {{placeholder}}." },
          { index: 2, text: "Third sample segment with\nline break." },
        ],
        request.sourceLanguage,
        request.targetLanguage,
      ),
    };
  }

  protected buildMessages(
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
        content: this.buildPrompt(segments, sourceLanguage, targetLanguage),
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
      "Example for 3 input segments:",
      '{"translatedSegments":[{"index":0,"text":"..."},{"index":1,"text":"..."},{"index":2,"text":"..."}]}',
      "Rules:",
      "- Preserve the same indexes.",
      "- Return one translated item for every input item.",
      "- The translatedSegments array length must equal the input segments length.",
      "- Preserve placeholders, variables, and line breaks.",
      "- Do not merge or split segments.",
      "- Do not wrap the JSON in markdown fences.",
      `- Source language code: ${sourceLanguage}.`,
      `- Target language code: ${targetLanguage}.`,
      "Segments:",
      JSON.stringify(segments),
    ].join("\n");
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

  private async requestOllama(messages: AIMessage[]) {
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), this.timeoutMs);

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
        signal: abortController.signal,
      });
    } catch (error) {
      throw createNetworkError(error, this.endpoint, this.model, this.timeoutMs, this.name);
    } finally {
      clearTimeout(timeout);
    }
  }
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

function normalizeLanguageName(languageCode: string) {
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

function createNetworkError(
  error: unknown,
  endpoint: string,
  model: string,
  timeoutMs: number,
  providerName: string,
) {
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
