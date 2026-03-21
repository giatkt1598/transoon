import type { SqlMigrationDefinition } from "./migration";

export const projectLastModifiedMigration: SqlMigrationDefinition = {
  id: "202603210005_ProjectLastModified",
  productVersion: "1.0.0",
  name: "Add lastModifiedAt to projects",
  up: `
    ALTER TABLE projects ADD COLUMN lastModifiedAt TEXT;
  `,
  down: `
    -- SQLite does not support dropping columns directly.
  `,
};
