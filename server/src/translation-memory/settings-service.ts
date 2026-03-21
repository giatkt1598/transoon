import { appConfig } from "../config/app-config";
import { TranslateProvider } from "../translation-service";
import { createTranslationMemoryRepositories } from "./repositories/repository-service";

const INLINE_TRANSLATE_PROVIDER_KEY = "inlineTranslateProvider";

export type AppSettings = {
  inlineTranslateProvider: string;
};

export function getAppSettings(): AppSettings {
  const repositories = createTranslationMemoryRepositories();
  const storedInlineTranslateProvider =
    repositories.appSettings.getByKey(INLINE_TRANSLATE_PROVIDER_KEY)?.value ??
    appConfig.defaultTranslateProvider;
  const inlineTranslateProvider = isTranslateProviderAvailable(
    storedInlineTranslateProvider,
  )
    ? storedInlineTranslateProvider
    : appConfig.defaultTranslateProvider;

  return {
    inlineTranslateProvider,
  };
}

export function updateAppSettings(input: Partial<AppSettings>) {
  const repositories = createTranslationMemoryRepositories();
  const currentSettings = getAppSettings();
  const nextInlineTranslateProvider =
    input.inlineTranslateProvider ?? currentSettings.inlineTranslateProvider;

  assertTranslateProviderExists(nextInlineTranslateProvider);

  repositories.appSettings.upsert({
    key: INLINE_TRANSLATE_PROVIDER_KEY,
    value: nextInlineTranslateProvider,
    updatedAt: new Date().toISOString(),
  });

  return getAppSettings();
}

function assertTranslateProviderExists(providerName: string) {
  if (!isTranslateProviderAvailable(providerName)) {
    throw new Error("Inline translate provider is not available.");
  }
}

function isTranslateProviderAvailable(providerName: string) {
  return TranslateProvider.list().some(
    (provider) => provider.name === providerName,
  );
}
