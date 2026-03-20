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
  name: "Qwen2.5 Coder 7B",
  description:
    "Local Ollama model qwen2.5-coder:7b adapted for translation tasks.",
})
export class Qwen25Coder7BProvider extends AITranslateProvider {
  readonly name = "Qwen2.5 Coder 7B";
  protected readonly model = "qwen2.5-coder:7b";
  protected readonly chunkSize = 100;

  protected extractContent(data: unknown) {
    const response = data as QwenResponse;
    const content = response.message?.content;
    return content;
  }
}
