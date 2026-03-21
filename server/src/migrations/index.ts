import type { MigrationDefinition } from "./migration";
import { initialTranslationMemoryMigration } from "./202603210001_initial-translation-memory";
import { translationMemoryManagementMigration } from "./202603210002_translation-memory-management";
import { projectStatusMigration } from "./202603210003_project-status";

export const migrations: MigrationDefinition[] = [
  initialTranslationMemoryMigration,
  translationMemoryManagementMigration,
  projectStatusMigration,
];
