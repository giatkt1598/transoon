import type { MigrationDefinition } from "./migration";
import { initialTranslationMemoryMigration } from "./202603210001_initial-translation-memory";
import { translationMemoryManagementMigration } from "./202603210002_translation-memory-management";
import { projectStatusMigration } from "./202603210003_project-status";
import { appSettingsMigration } from "./202603210004_app-settings";
import { projectLastModifiedMigration } from "./202603210005_project-last-modified";
import { projectContentCountsMigration } from "./202603210006_project-content-counts";
import { translationUnitMemoryLinkMigration } from "./202603210007_translation-unit-memory-link";
import { segmentMergeSupportMigration } from "./202603210008_segment-merge-support";
import { segmentSplitSupportMigration } from "./202603210009_segment-split-support";

export const migrations: MigrationDefinition[] = [
  initialTranslationMemoryMigration,
  translationMemoryManagementMigration,
  projectStatusMigration,
  appSettingsMigration,
  projectLastModifiedMigration,
  projectContentCountsMigration,
  translationUnitMemoryLinkMigration,
  segmentMergeSupportMigration,
  segmentSplitSupportMigration,
];
