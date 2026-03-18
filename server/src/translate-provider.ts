export type TranslationResult = {
  translatedSegments: string[];
  warnings: string[];
  provider: string;
};

export type TranslateRequest = {
  segments: string[];
  sourceLanguage: string;
  targetLanguage: string;
};

type TranslateProviderConstructor = new () => TranslateProvider;

export abstract class TranslateProvider {
  private static readonly registry = new Map<string, TranslateProviderConstructor>();

  static register(name: string, providerClass: TranslateProviderConstructor) {
    this.registry.set(name, providerClass);
  }

  static resolve(name: string): TranslateProvider {
    const providerClass = this.registry.get(name);

    if (!providerClass) {
      const supportedProviders = Array.from(this.registry.keys()).join(", ");
      throw new Error(
        `Unknown translate provider "${name}". Registered providers: ${supportedProviders || "none"}.`,
      );
    }

    return new providerClass();
  }

  static list() {
    return Array.from(this.registry.keys());
  }

  abstract readonly name: string;

  abstract translate(request: TranslateRequest): Promise<TranslationResult>;
}

export function RegisterTranslateProvider(name: string) {
  return function <T extends TranslateProviderConstructor>(providerClass: T) {
    TranslateProvider.register(name, providerClass);
  };
}
