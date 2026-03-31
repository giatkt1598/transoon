import type { SqlMigrationDefinition } from "./migration";

export const notificationsMigration: SqlMigrationDefinition = {
  id: "202603210013_Notifications",
  productVersion: "1.0.0",
  name: "Add notifications table",
  up: `
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      projectId TEXT NULL,
      requestId TEXT NULL,
      projectName TEXT NOT NULL,
      providerName TEXT NULL,
      phase TEXT NOT NULL,
      message TEXT NOT NULL,
      progressPercent REAL NOT NULL,
      completedSegments INTEGER NOT NULL,
      totalSegments INTEGER NOT NULL,
      unitLabel TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      startedAt TEXT NULL,
      completedAt TEXT NULL,
      durationMs INTEGER NULL,
      downloadUrl TEXT NULL,
      unread INTEGER NOT NULL DEFAULT 1
    );

    CREATE INDEX IF NOT EXISTS idx_notifications_updatedAt
    ON notifications(updatedAt DESC);

    CREATE INDEX IF NOT EXISTS idx_notifications_projectId
    ON notifications(projectId);

    CREATE INDEX IF NOT EXISTS idx_notifications_requestId
    ON notifications(requestId);
  `,
  down: `
    DROP INDEX IF EXISTS idx_notifications_requestId;
    DROP INDEX IF EXISTS idx_notifications_projectId;
    DROP INDEX IF EXISTS idx_notifications_updatedAt;
    DROP TABLE IF EXISTS notifications;
  `,
};
