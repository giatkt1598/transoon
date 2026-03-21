import {
  RegisterTranslateProvider,
  TranslatePromptContext,
  TranslateRequest,
} from "../translate-provider";
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
  protected readonly model = "gemma3:1b";
  protected readonly chunkSize = 60;

  protected extractContent(data: unknown) {
    const response = data as GemmaResponse;
    const content = response.message?.content;
    return content;
  }

  protected buildMessagesForInline(
    request: TranslateRequest,
    segments: Array<{ index: number; text: string }>,
    sourceLanguage: string,
    targetLanguage: string,
  ): { role: "system" | "user" | "assistant"; content: string }[] {
    return [
      {
        role: "user",
        content: `Translate this text from ${normalizeLanguageName(sourceLanguage)} to ${normalizeLanguageName(targetLanguage)}, output only result in plaintext: ${segments[0].text}`,
      },
    ];
  }
}
