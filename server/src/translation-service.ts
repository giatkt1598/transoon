import { TranslateProvider, type TranslationResult } from "./translate-provider";
import "./providers/azure-translate-provider";

export type { TranslationResult } from "./translate-provider";
export { TranslateProvider } from "./translate-provider";

export async function translateSegments(
  segments: string[],
  sourceLanguage: string,
  targetLanguage: string,
  providerName = "Azure Translate Provider",
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
    const message = error instanceof Error ? error.message : "Unknown translation provider failure.";

    return {
      translatedSegments: normalizedSegments,
      warnings: [`Translation provider failed, so the output document keeps the original text. Details: ${message}`],
      provider: providerName,
    };
  }
}
