import type { SqlMigrationDefinition } from "./migration";

export const projectStatusMigration: SqlMigrationDefinition = {
  id: "202603210003_ProjectStatus",
  productVersion: "1.0.0",
  name: "Add project status for background processing",
  up: `
    ALTER TABLE projects
    ADD COLUMN status TEXT NOT NULL DEFAULT 'idle'
      CHECK (status IN ('idle', 'auto-translate-processing'));

    CREATE INDEX IF NOT EXISTS idx_projects_status
      ON projects(status);
  `,
  down: `
    DROP INDEX IF EXISTS idx_projects_status;
  `,
};
