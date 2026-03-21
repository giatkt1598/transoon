import type { MigrationDefinition } from "./migration";
import { initialTranslationMemoryMigration } from "./202603210001_initial-translation-memory";
import { translationMemoryManagementMigration } from "./202603210002_translation-memory-management";

export const migrations: MigrationDefinition[] = [
  initialTranslationMemoryMigration,
  translationMemoryManagementMigration,
];
