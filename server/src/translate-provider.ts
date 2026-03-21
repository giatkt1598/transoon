export type TranslationResult = {
  translatedSegments: string[];
  warnings: string[];
  provider: string;
};

export type TranslateProgress = {
  phase: "queued" | "extracting" | "translating" | "merging" | "completed" | "failed";
  totalChunks: number;
  completedChunks: number;
  progressPercent: number;
  message: string;
};

export type TranslatePromptPreview = {
  supported: boolean;
  content: string | null;
};

export type TranslateRequest = {
  segments: string[];
  sourceLanguage: string;
  targetLanguage: string;
  onProgress?: (progress: TranslateProgress) => void | Promise<void>;
  onTranslatedSegments?: (
    translatedSegments: Array<{ index: number; text: string }>,
  ) => void | Promise<void>;
};

export type TranslateProviderDefinition = {
  name: string;
  description: string;
};

type TranslateProviderConstructor = new () => TranslateProvider;

export abstract class TranslateProvider {
  private static readonly registry = new Map<
    string,
    { providerClass: TranslateProviderConstructor; definition: TranslateProviderDefinition }
  >();

  static register(
    definition: TranslateProviderDefinition,
    providerClass: TranslateProviderConstructor,
  ) {
    this.registry.set(definition.name, { providerClass, definition });
  }

  static resolve(name: string): TranslateProvider {
    const entry = this.registry.get(name);

    if (!entry) {
      const supportedProviders = Array.from(this.registry.keys()).join(", ");
      throw new Error(
        `Unknown translate provider "${name}". Registered providers: ${supportedProviders || "none"}.`,
      );
    }

    return new entry.providerClass();
  }

  static list() {
    return Array.from(this.registry.values()).map((entry) => entry.definition);
  }

  abstract readonly name: string;

  abstract translate(request: TranslateRequest): Promise<TranslationResult>;

  getPromptPreview(_request: TranslateRequest): TranslatePromptPreview {
    return {
      supported: false,
      content: null,
    };
  }
}

export function RegisterTranslateProvider(definition: TranslateProviderDefinition) {
  return function <T extends TranslateProviderConstructor>(providerClass: T) {
    TranslateProvider.register(definition, providerClass);
  };
}
