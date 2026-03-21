import type { SqlMigrationDefinition } from "./migration";

export const appSettingsMigration: SqlMigrationDefinition = {
  id: "202603210004_AppSettings",
  productVersion: "1.0.0",
  name: "Add app settings table",
  up: `
    CREATE TABLE IF NOT EXISTS appSettings (
      "key" TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
  `,
  down: `
    DROP TABLE IF EXISTS appSettings;
  `,
};
