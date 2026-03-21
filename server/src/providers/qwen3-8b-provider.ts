import { RegisterTranslateProvider } from "../translate-provider";
import { AITranslateProvider } from "./ai-translate-provider";

type QwenResponse = {
  message?: {
    role?: string;
    content?: string;
  };
  done?: boolean;
};

@RegisterTranslateProvider({
  name: "Qwen3 8B",
  description: "Local Ollama model qwen3:8b adapted for translation tasks.",
})
export class Qwen38BProvider extends AITranslateProvider {
  readonly name = "Qwen3 8B";
  protected readonly model = "qwen3:8b";
  protected readonly chunkSize = 500;

  protected extractContent(data: unknown) {
    const response = data as QwenResponse;
    const content = response.message?.content;
    return content;
  }
}
