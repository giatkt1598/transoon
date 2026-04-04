export const appConfig = {
  port: Number(process.env.PORT ?? 3000),
  defaultSourceLanguage: "en",
  defaultTargetLanguage: "ja",
  defaultTranslateProvider: "Azure Translate Provider",
  translationMemoryDatabasePath:
    process.env.TRANSLATION_MEMORY_DATABASE_PATH ?? "storage/translation-memory.sqlite",
  projectDocumentsStoragePath:
    process.env.PROJECT_DOCUMENTS_STORAGE_PATH ?? "storage/project-documents",
} as const;
