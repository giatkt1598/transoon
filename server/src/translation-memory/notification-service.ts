import { getTranslationMemoryDatabase } from "./database";
import type { NotificationEntity } from "./entities";

export type NotificationRecord = {
  id: string;
  kind: NotificationEntity["kind"];
  projectId: string | null;
  requestId: string | null;
  projectName: string;
  providerName: string | null;
  phase: NotificationEntity["phase"];
  message: string;
  progressPercent: number;
  completedSegments: number;
  totalSegments: number;
  unitLabel: NotificationEntity["unitLabel"];
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  downloadUrl: string | null;
  unread: boolean;
};

export function listNotifications() {
  const database = getTranslationMemoryDatabase();
  const rows = database
    .prepare(
      `
        SELECT
          id,
          kind,
          projectId,
          requestId,
          projectName,
          providerName,
          phase,
          message,
          progressPercent,
          completedSegments,
          totalSegments,
          unitLabel,
          updatedAt,
          startedAt,
          completedAt,
          durationMs,
          downloadUrl,
          unread
        FROM notifications
        ORDER BY updatedAt DESC
      `,
    )
    .all() as NotificationEntity[];

  return rows.map(mapNotificationRecord);
}

export function upsertNotification(input: NotificationRecord) {
  const database = getTranslationMemoryDatabase();
  database
    .prepare(
      `
        INSERT INTO notifications (
          id,
          kind,
          projectId,
          requestId,
          projectName,
          providerName,
          phase,
          message,
          progressPercent,
          completedSegments,
          totalSegments,
          unitLabel,
          updatedAt,
          startedAt,
          completedAt,
          durationMs,
          downloadUrl,
          unread
        )
        VALUES (
          @id,
          @kind,
          @projectId,
          @requestId,
          @projectName,
          @providerName,
          @phase,
          @message,
          @progressPercent,
          @completedSegments,
          @totalSegments,
          @unitLabel,
          @updatedAt,
          @startedAt,
          @completedAt,
          @durationMs,
          @downloadUrl,
          @unread
        )
        ON CONFLICT(id) DO UPDATE SET
          kind = excluded.kind,
          projectId = excluded.projectId,
          requestId = excluded.requestId,
          projectName = excluded.projectName,
          providerName = excluded.providerName,
          phase = excluded.phase,
          message = excluded.message,
          progressPercent = excluded.progressPercent,
          completedSegments = excluded.completedSegments,
          totalSegments = excluded.totalSegments,
          unitLabel = excluded.unitLabel,
          updatedAt = excluded.updatedAt,
          startedAt = excluded.startedAt,
          completedAt = excluded.completedAt,
          durationMs = excluded.durationMs,
          downloadUrl = excluded.downloadUrl,
          unread = excluded.unread
      `,
    )
    .run({
      ...input,
      unread: input.unread ? 1 : 0,
    });

  return getNotificationById(input.id);
}

export function markNotificationAsRead(notificationId: string) {
  const database = getTranslationMemoryDatabase();
  database
    .prepare(`UPDATE notifications SET unread = 0 WHERE id = ?`)
    .run(notificationId);
}

export function markAllNotificationsAsRead() {
  const database = getTranslationMemoryDatabase();
  database.prepare(`UPDATE notifications SET unread = 0`).run();
}

export function clearAllNotifications() {
  const database = getTranslationMemoryDatabase();
  database.prepare(`DELETE FROM notifications`).run();
}

export function getNotificationById(notificationId: string) {
  const database = getTranslationMemoryDatabase();
  const row = database
    .prepare(
      `
        SELECT
          id,
          kind,
          projectId,
          requestId,
          projectName,
          providerName,
          phase,
          message,
          progressPercent,
          completedSegments,
          totalSegments,
          unitLabel,
          updatedAt,
          startedAt,
          completedAt,
          durationMs,
          downloadUrl,
          unread
        FROM notifications
        WHERE id = ?
      `,
    )
    .get(notificationId) as NotificationEntity | undefined;

  return row ? mapNotificationRecord(row) : null;
}

function mapNotificationRecord(row: NotificationEntity): NotificationRecord {
  return {
    ...row,
    unread: row.unread === 1,
  };
}
