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
  name: "Qwen3 Coder 30B",
  description:
    "Local Ollama model qwen2.5-coder:7b adapted for translation tasks.",
})
export class Qwen3Coder30BProvider extends AITranslateProvider {
  readonly name = "Qwen3 Coder 30B";
  protected readonly model = "qwen3-coder:30b";
  protected readonly chunkSize = 500;

  protected extractContent(data: unknown) {
    const response = data as QwenResponse;
    const content = response.message?.content;
    return content;
  }
}
