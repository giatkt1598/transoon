import type { SqlMigrationDefinition } from "./migration";

export const translationUnitMemoryLinkMigration: SqlMigrationDefinition = {
  id: "202603210007_TranslationUnitMemoryLink",
  productVersion: "1.0.0",
  name: "Add translation memory link to translation units",
  up: `
    ALTER TABLE translation_units
    ADD COLUMN translationMemoryId TEXT REFERENCES translationMemories(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_translation_units_memory_lookup
      ON translation_units(translationMemoryId, sourceLanguage, targetLanguage, sourceTextHash);
  `,
  down: `
    DROP INDEX IF EXISTS idx_translation_units_memory_lookup;
  `,
};
