import type { SqlMigrationDefinition } from "./migration";

export const projectGlossaryLinkMigration: SqlMigrationDefinition = {
  id: "202603210012_ProjectGlossaryLink",
  productVersion: "1.0.0",
  name: "Attach glossaries to projects",
  up: `
    CREATE TABLE IF NOT EXISTS projectGlossaries (
      projectId TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      glossaryId TEXT NOT NULL REFERENCES glossaries(id) ON DELETE CASCADE,
      priority INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (projectId, glossaryId)
    );

    CREATE INDEX IF NOT EXISTS idx_project_glossaries_priority
      ON projectGlossaries(projectId, priority ASC);
  `,
  down: `
    DROP INDEX IF EXISTS idx_project_glossaries_priority;
    DROP TABLE IF EXISTS projectGlossaries;
  `,
};
