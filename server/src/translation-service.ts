import {
  TranslateProvider,
  type TranslationResult,
} from "./translate-provider";
import "./providers/google-translate-provider";
import "./providers/deepseek-r1-provider";
import "./providers/gemma3-1b-provider";
import "./providers/gemma3-4b-provider";
import "./providers/qwen2.5-coder-7b-provider";
import "./providers/qwen3-coder-30b-provider";
import "./providers/qwen3-8b-provider";

export type { TranslationResult } from "./translate-provider";
export { TranslateProvider } from "./translate-provider";

export async function translateSegments(
  segments: string[],
  sourceLanguage: string,
  targetLanguage: string,
  providerName = "Google Translate",
  onProgress?: Parameters<TranslateProvider["translate"]>[0]["onProgress"],
): Promise<TranslationResult> {
  const normalizedSegments = segments.map((segment) => segment ?? "");

  if (sourceLanguage === targetLanguage) {
    return {
      translatedSegments: normalizedSegments,
      warnings: [],
      provider: providerName,
    };
  }

  try {
    return await TranslateProvider.resolve(providerName).translate({
      segments: normalizedSegments,
      sourceLanguage,
      targetLanguage,
      onProgress,
    });
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
      provider: providerName,
    };
  }
}
