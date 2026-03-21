import type { MigrationDefinition } from "./migration";
import { initialTranslationMemoryMigration } from "./202603210001_initial-translation-memory";

export const migrations: MigrationDefinition[] = [
  initialTranslationMemoryMigration,
];
