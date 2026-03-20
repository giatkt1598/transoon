export const appConfig = {
  port: Number(process.env.PORT ?? 3000),
  defaultSourceLanguage: "en",
  defaultTargetLanguage: "ja",
  defaultTranslateProvider: "Google Translate",
  translationMemoryDatabasePath:
    process.env.TRANSLATION_MEMORY_DATABASE_PATH ?? "storage/translation-memory.sqlite",
} as const;
