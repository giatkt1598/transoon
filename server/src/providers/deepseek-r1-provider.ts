import {
  RegisterTranslateProvider,
  TranslateProvider,
  type TranslateRequest,
  type TranslationResult,
} from "../translate-provider";

type DeepSeekMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type DeepSeekResponse = {
  message?: {
    role?: string;
    content?: string;
    thinking?: string;
  };
  done?: boolean;
};

@RegisterTranslateProvider("DeepSeek r1")
export class DeepSeekR1Provider extends TranslateProvider {
  readonly name = "DeepSeek r1";
  private readonly endpoint = process.env.OLLAMA_API_URL ?? "http://localhost:11434/api/chat";
  private readonly model = process.env.DEEPSEEK_OLLAMA_MODEL ?? "deepseek-r1:8b";

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

    for (const chunk of chunks) {
      const payload = chunk.map((item) => ({
        index: item.index,
        text: item.text,
      }));
      const messages: DeepSeekMessage[] = [
        {
          role: "system",
          content:
            "You are a translation engine. Return JSON only. Do not add explanations. Keep the same number of items and preserve placeholders, whitespace, and line breaks as closely as possible.",
        },
        {
          role: "user",
          content: buildPrompt(payload, request.sourceLanguage, request.targetLanguage),
        },
      ];

      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`DeepSeek request failed with status ${response.status}.`);
      }

      const data = (await response.json()) as DeepSeekResponse;
      const content = data.message?.content;
      if (!content) {
        throw new Error("DeepSeek returned an empty completion.");
      }

      const parsed = parseTranslatedSegments(content);

      parsed.translatedSegments?.forEach((item) => {
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
    if (currentChunk.length > 0 && nextLength > 12000) {
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

function buildPrompt(
  segments: Array<{ index: number; text: string }>,
  sourceLanguage: string,
  targetLanguage: string,
) {
  return [
    `Translate each segment from ${sourceLanguage} to ${targetLanguage}.`,
    "Return strict JSON only with this shape:",
    '{"translatedSegments":[{"index":0,"text":"translated text"}]}',
    "Rules:",
    "- Preserve the same indexes.",
    "- Preserve placeholders, variables, and line breaks.",
    "- Do not merge or split segments.",
    "- Do not wrap the JSON in markdown fences.",
    "Segments:",
    JSON.stringify(segments),
  ].join("\n");
}

function parseTranslatedSegments(content: string) {
  const jsonText = extractJsonObject(content);
  return JSON.parse(jsonText) as {
    translatedSegments?: Array<{ index: number; text: string }>;
  };
}

function extractJsonObject(content: string) {
  const fencedMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1]?.trim() ?? content.trim();

  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
    throw new Error("DeepSeek response did not contain a JSON object.");
  }

  return candidate.slice(firstBrace, lastBrace + 1);
}
