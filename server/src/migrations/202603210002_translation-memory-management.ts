import type { SqlMigrationDefinition } from "./migration";

export const translationMemoryManagementMigration: SqlMigrationDefinition = {
  id: "202603210002_TranslationMemoryManagement",
  productVersion: "1.0.0",
  name: "Add translation memory management tables",
  up: `
    CREATE TABLE IF NOT EXISTS translationMemories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sourceLanguage TEXT NOT NULL,
      targetLanguage TEXT NOT NULL,
      lastModifiedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      lastUsedAt TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS projectTranslationMemories (
      projectId TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      translationMemoryId TEXT NOT NULL REFERENCES translationMemories(id) ON DELETE CASCADE,
      accessMode TEXT NOT NULL CHECK (accessMode IN ('read', 'write')),
      priority INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (projectId, translationMemoryId)
    );

    CREATE TABLE IF NOT EXISTS terms (
      id TEXT PRIMARY KEY,
      translationMemoryId TEXT NOT NULL REFERENCES translationMemories(id) ON DELETE CASCADE,
      sourceTerm TEXT NOT NULL,
      sourceTermNormalized TEXT NOT NULL,
      targetTerm TEXT NOT NULL,
      targetTermNormalized TEXT NOT NULL,
      lastModifiedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      lastUsedAt TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(translationMemoryId, sourceTermNormalized)
    );

    CREATE INDEX IF NOT EXISTS idx_translation_memories_language_pair
      ON translationMemories(sourceLanguage, targetLanguage);

    CREATE INDEX IF NOT EXISTS idx_project_translation_memories_priority
      ON projectTranslationMemories(projectId, priority ASC);

    CREATE UNIQUE INDEX IF NOT EXISTS idx_project_translation_memories_single_write
      ON projectTranslationMemories(projectId)
      WHERE accessMode = 'write';

    CREATE INDEX IF NOT EXISTS idx_terms_translation_memory
      ON terms(translationMemoryId, sourceTermNormalized);

    CREATE INDEX IF NOT EXISTS idx_terms_last_used
      ON terms(lastUsedAt);
  `,
  down: `
    DROP INDEX IF EXISTS idx_terms_last_used;
    DROP INDEX IF EXISTS idx_terms_translation_memory;
    DROP INDEX IF EXISTS idx_project_translation_memories_single_write;
    DROP INDEX IF EXISTS idx_project_translation_memories_priority;
    DROP INDEX IF EXISTS idx_translation_memories_language_pair;
    DROP TABLE IF EXISTS terms;
    DROP TABLE IF EXISTS projectTranslationMemories;
    DROP TABLE IF EXISTS translationMemories;
  `,
};
