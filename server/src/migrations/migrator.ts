import type { DatabaseSync } from "node:sqlite";
import { migrations } from "./index";
import { runMigrationUp } from "./migration";

const migrationsHistoryTableName = "__EFMigrationsHistory";

export function applyPendingMigrations(database: DatabaseSync) {
  ensureMigrationsHistoryTable(database);

  const appliedMigrationIds = new Set(
    (
      database
        .prepare(
          `SELECT migrationId FROM "${migrationsHistoryTableName}" ORDER BY migrationId`,
        )
        .all() as Array<{ migrationId: string }>
    ).map((row) => row.migrationId),
  );

  for (const migration of migrations) {
    if (appliedMigrationIds.has(migration.id)) {
      continue;
    }

    database.exec("BEGIN");

    try {
      runMigrationUp(database, migration);
      database
        .prepare(
          `INSERT INTO "${migrationsHistoryTableName}" (migrationId, productVersion) VALUES (?, ?)`,
        )
        .run(migration.id, migration.productVersion);
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  }
}

function ensureMigrationsHistoryTable(database: DatabaseSync) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS "${migrationsHistoryTableName}" (
      migrationId TEXT PRIMARY KEY,
      productVersion TEXT NOT NULL,
      appliedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}
