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
  name: "GPT-OSS 20B",
  description: "Local Ollama model gpt-oss:20b for stronger translation quality.",
})
export class GptOss20BProvider extends AITranslateProvider {
  readonly name = "GPT-OSS 20B";
  protected readonly model = "gpt-oss:20b";
  protected readonly chunkSize = 500;

  protected extractContent(data: unknown) {
    const response = data as GemmaResponse;
    return response.message?.content;
  }
}
