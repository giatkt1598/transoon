import { RegisterTranslateProvider } from "../translate-provider";
import { AITranslateProvider } from "./ai-translate-provider";

type DeepSeekResponse = {
  message?: {
    role?: string;
    content?: string;
    thinking?: string;
  };
  done?: boolean;
};

@RegisterTranslateProvider({
  name: "DeepSeek r1",
  description:
    "Local Ollama model deepseek-r1:8b for reasoning-heavy translation.",
})
export class DeepSeekR1Provider extends AITranslateProvider {
  readonly name = "DeepSeek r1";
  protected readonly model = "deepseek-r1:8b";
  protected readonly chunkSize = 3000;

  protected extractContent(data: unknown) {
    const response = data as DeepSeekResponse;
    return response.message?.content ?? response.message?.thinking;
  }
}
