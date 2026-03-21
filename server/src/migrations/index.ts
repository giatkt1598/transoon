import type { MigrationDefinition } from "./migration";
import { initialTranslationMemoryMigration } from "./202603210001_initial-translation-memory";
import { translationMemoryManagementMigration } from "./202603210002_translation-memory-management";
import { projectStatusMigration } from "./202603210003_project-status";
import { appSettingsMigration } from "./202603210004_app-settings";

export const migrations: MigrationDefinition[] = [
  initialTranslationMemoryMigration,
  translationMemoryManagementMigration,
  projectStatusMigration,
  appSettingsMigration,
];
