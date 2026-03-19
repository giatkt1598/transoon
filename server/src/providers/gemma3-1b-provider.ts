import { normalize } from "path";
import { RegisterTranslateProvider } from "../translate-provider";
import {
  AITranslateProvider,
  normalizeLanguageName,
} from "./ai-translate-provider";

type GemmaResponse = {
  message?: {
    role?: string;
    content?: string;
  };
  done?: boolean;
};

@RegisterTranslateProvider({
  name: "Gemma3 1B",
  description: "Local Ollama model gemma3:1b for lightweight translation.",
})
export class Gemma31BProvider extends AITranslateProvider {
  readonly name = "Gemma3 1B";
  protected readonly model = process.env.GEMMA3_OLLAMA_MODEL ?? "gemma3:1b";
  protected readonly chunkSize = 60;

  protected buildPrompt(
    segments: Array<{ index: number; text: string }>,
    sourceLanguage: string,
    targetLanguage: string,
  ): string {
    return [
      `Please translate to ${normalizeLanguageName(targetLanguage)} from ${normalizeLanguageName(sourceLanguage)}.`,
      'Output strict in json format: [{"index":number,"text":"string"}]',
      "Segments:",
      JSON.stringify(segments),
    ].join("\n");
  }

  protected extractContent(data: unknown) {
    const response = data as GemmaResponse;
    const content = response.message?.content;
    if (content) {
      const _content = content
        .replace(/^```json/g, "")
        .replace(/```$/g, "")
        .replace(/\n/g, "");
      return JSON.stringify({
        translatedSegments: JSON.parse(_content),
      });
    }
    return undefined;
  }
}
