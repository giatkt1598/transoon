import type { DatabaseSync } from "node:sqlite";

export type SqlMigrationDefinition = {
  id: string;
  productVersion: string;
  name: string;
  up: string;
  down?: string;
};

export type MigrationDefinition = SqlMigrationDefinition | {
  id: string;
  productVersion: string;
  name: string;
  up: (database: DatabaseSync) => void;
  down?: (database: DatabaseSync) => void;
};

export function runMigrationUp(
  database: DatabaseSync,
  migration: MigrationDefinition,
) {
  if (typeof migration.up === "string") {
    database.exec(migration.up);
    return;
  }

  migration.up(database);
}

export function runMigrationDown(
  database: DatabaseSync,
  migration: MigrationDefinition,
) {
  if (!migration.down) {
    return;
  }

  if (typeof migration.down === "string") {
    database.exec(migration.down);
    return;
  }

  migration.down(database);
}
