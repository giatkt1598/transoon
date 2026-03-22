import { appConfig } from "../config/app-config";
import { TranslateProvider } from "../translation-service";
import { createTranslationMemoryRepositories } from "./repositories/repository-service";

const INLINE_TRANSLATE_PROVIDER_KEY = "inlineTranslateProvider";
const TERM_FUZZY_MATCH_THRESHOLD_KEY = "termFuzzyMatchThreshold";
const DEFAULT_TERM_FUZZY_MATCH_THRESHOLD = 0.9;

export type AppSettings = {
  inlineTranslateProvider: string;
  termFuzzyMatchThreshold: number;
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
  const storedTermFuzzyMatchThreshold =
    repositories.appSettings.getByKey(TERM_FUZZY_MATCH_THRESHOLD_KEY)?.value ??
    String(DEFAULT_TERM_FUZZY_MATCH_THRESHOLD);
  const parsedTermFuzzyMatchThreshold = Number.parseFloat(
    storedTermFuzzyMatchThreshold,
  );
  const termFuzzyMatchThreshold = isValidTermFuzzyMatchThreshold(
    parsedTermFuzzyMatchThreshold,
  )
    ? parsedTermFuzzyMatchThreshold
    : DEFAULT_TERM_FUZZY_MATCH_THRESHOLD;

  return {
    inlineTranslateProvider,
    termFuzzyMatchThreshold,
  };
}

export function updateAppSettings(input: Partial<AppSettings>) {
  const repositories = createTranslationMemoryRepositories();
  const currentSettings = getAppSettings();
  const nextInlineTranslateProvider =
    input.inlineTranslateProvider ?? currentSettings.inlineTranslateProvider;
  const nextTermFuzzyMatchThreshold =
    input.termFuzzyMatchThreshold ?? currentSettings.termFuzzyMatchThreshold;

  assertTranslateProviderExists(nextInlineTranslateProvider);
  assertTermFuzzyMatchThresholdIsValid(nextTermFuzzyMatchThreshold);

  repositories.appSettings.upsert({
    key: INLINE_TRANSLATE_PROVIDER_KEY,
    value: nextInlineTranslateProvider,
    updatedAt: new Date().toISOString(),
  });
  repositories.appSettings.upsert({
    key: TERM_FUZZY_MATCH_THRESHOLD_KEY,
    value: String(nextTermFuzzyMatchThreshold),
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

function assertTermFuzzyMatchThresholdIsValid(value: number) {
  if (!isValidTermFuzzyMatchThreshold(value)) {
    throw new Error("Term fuzzy match threshold must be a number between 0 and 1.");
  }
}

function isValidTermFuzzyMatchThreshold(value: number) {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}
