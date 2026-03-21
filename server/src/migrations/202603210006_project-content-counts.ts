import type { SqlMigrationDefinition } from "./migration";

export const projectContentCountsMigration: SqlMigrationDefinition = {
  id: "202603210006_ProjectContentCounts",
  productVersion: "1.0.0",
  name: "Add wordCount and characterCount to projects",
  up: `
    ALTER TABLE projects ADD COLUMN wordCount INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE projects ADD COLUMN characterCount INTEGER NOT NULL DEFAULT 0;
  `,
  down: `
    -- SQLite does not support dropping columns directly.
  `,
};
