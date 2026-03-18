import translate from "google-translate-api-x";

export type TranslationResult = {
  translatedSegments: string[];
  warnings: string[];
  provider: "google-translate-api-x" | "fallback";
};

export async function translateSegments(
  segments: string[],
  sourceLanguage: string,
  targetLanguage: string,
): Promise<TranslationResult> {
  if (sourceLanguage === targetLanguage) {
    return {
      translatedSegments: segments,
      warnings: [],
      provider: "fallback",
    };
  }

  const normalizedSegments = segments.map((segment) => segment ?? "");
  const nonEmptySegments = normalizedSegments.filter((segment) => segment.trim().length > 0);

  if (nonEmptySegments.length === 0) {
    return {
      translatedSegments: normalizedSegments,
      warnings: [],
      provider: "fallback",
    };
  }

  try {
    const translatedMap = new Map<string, string[]>();
    const chunks = buildChunks(normalizedSegments);

    for (const chunk of chunks) {
      const inputs = chunk.map((item) => item.text);
      const response = await translate(inputs, {
        from: sourceLanguage,
        to: targetLanguage,
        client: "gtx",
      } as Parameters<typeof translate>[1]);

      response.forEach((result, index) => {
        const originalIndex = chunk[index].index;
        translatedMap.set(String(originalIndex), [result.text]);
      });
    }

    return {
      translatedSegments: normalizedSegments.map((segment, index) => {
        const translated = translatedMap.get(String(index));
        return translated?.[0] ?? segment;
      }),
      warnings: [],
      provider: "google-translate-api-x",
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown translation provider failure.";

    return {
      translatedSegments: normalizedSegments,
      warnings: [
        `Translation provider failed, so the output document keeps the original text. Details: ${message}`,
      ],
      provider: "fallback",
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
