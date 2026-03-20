import { RegisterTranslateProvider } from "../translate-provider";
import { AITranslateProvider } from "./ai-translate-provider";

type GemmaResponse = {
  message?: {
    role?: string;
    content?: string;
  };
  done?: boolean;
};

@RegisterTranslateProvider({
  name: "Gemma3 4B",
  description: "Local Ollama model gemma3:4b for stronger translation quality.",
})
export class Gemma34BProvider extends AITranslateProvider {
  readonly name = "Gemma3 4B";
  protected readonly model = "gemma3:4b";
  protected readonly chunkSize = 500;

  protected extractContent(data: unknown) {
    const response = data as GemmaResponse;
    return response.message?.content;
  }
}
