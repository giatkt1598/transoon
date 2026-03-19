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
  name: "Gemma3 1B",
  description: "Local Ollama model gemma3:1b for lightweight translation.",
})
export class Gemma31BProvider extends AITranslateProvider {
  readonly name = "Gemma3 1B";
  protected readonly model = process.env.GEMMA3_OLLAMA_MODEL ?? "gemma3:1b";
  protected readonly chunkSize = 200;

  protected extractContent(data: unknown) {
    const response = data as GemmaResponse;
    return response.message?.content;
  }
}
