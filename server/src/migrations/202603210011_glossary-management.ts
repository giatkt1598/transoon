import type { SqlMigrationDefinition } from "./migration";

export const glossaryManagementMigration: SqlMigrationDefinition = {
  id: "202603210011_GlossaryManagement",
  productVersion: "1.0.0",
  name: "Add glossary management tables",
  up: `
    CREATE TABLE IF NOT EXISTS glossaries (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sourceLanguage TEXT NOT NULL,
      targetLanguage TEXT NOT NULL,
      lastModifiedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      lastUsedAt TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS glossaryItems (
      id TEXT PRIMARY KEY,
      glossaryId TEXT NOT NULL REFERENCES glossaries(id) ON DELETE CASCADE,
      source TEXT NOT NULL,
      sourceNormalized TEXT NOT NULL,
      target TEXT NOT NULL,
      targetNormalized TEXT NOT NULL,
      caseSensitive INTEGER NOT NULL DEFAULT 0 CHECK (caseSensitive IN (0, 1)),
      wholeWord INTEGER NOT NULL DEFAULT 0 CHECK (wholeWord IN (0, 1)),
      priority INTEGER NOT NULL DEFAULT 0,
      lastModifiedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      lastUsedAt TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_glossaries_language_pair
      ON glossaries(sourceLanguage, targetLanguage);

    CREATE INDEX IF NOT EXISTS idx_glossary_items_glossary
      ON glossaryItems(glossaryId, priority DESC, sourceNormalized);

    CREATE INDEX IF NOT EXISTS idx_glossary_items_source
      ON glossaryItems(sourceNormalized);
  `,
  down: `
    DROP INDEX IF EXISTS idx_glossary_items_source;
    DROP INDEX IF EXISTS idx_glossary_items_glossary;
    DROP INDEX IF EXISTS idx_glossaries_language_pair;
    DROP TABLE IF EXISTS glossaryItems;
    DROP TABLE IF EXISTS glossaries;
  `,
};
