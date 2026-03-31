import { type TranslateProgress } from "./translate-provider";
import { Log } from "./logger";
import type { Server as SocketIOServer } from "socket.io";
import {
  getNotificationById,
  upsertNotification,
} from "./translation-memory/notification-service";

type TranslationProgressState = TranslateProgress & {
  requestId: string;
  updatedAt: string;
};

type TranslationNotificationMetadata = {
  fileName?: string;
  providerName?: string | null;
  downloadUrl?: string | null;
  durationMs?: number | null;
  completedAt?: string | null;
};

const progressStore = new Map<string, TranslationProgressState>();
const notificationMetadataStore = new Map<string, TranslationNotificationMetadata>();
const ttlMs = 30 * 60 * 1000;
let io: SocketIOServer | null = null;

export function attachTranslationProgressSocket(socketServer: SocketIOServer) {
  io = socketServer;
}

export function setTranslationProgress(
  requestId: string,
  progress: TranslateProgress,
  metadata?: TranslationNotificationMetadata,
) {
  cleanupExpiredProgress();
  if (metadata) {
    notificationMetadataStore.set(requestId, {
      ...notificationMetadataStore.get(requestId),
      ...metadata,
    });
  }

  const nextState = {
    requestId,
    ...progress,
    updatedAt: new Date().toISOString(),
  };

  progressStore.set(requestId, nextState);
  persistDocumentTranslationNotification(nextState);
  io?.to(requestId).emit("translation-progress", nextState);
}

export function getTranslationProgress(requestId: string) {
  cleanupExpiredProgress();
  return progressStore.get(requestId) ?? null;
}

export function registerTranslationNotificationMetadata(
  requestId: string,
  metadata: Required<Pick<TranslationNotificationMetadata, "fileName">> &
    Pick<TranslationNotificationMetadata, "providerName">,
) {
  notificationMetadataStore.set(requestId, {
    ...notificationMetadataStore.get(requestId),
    ...metadata,
  });
}

function cleanupExpiredProgress() {
  const now = Date.now();

  for (const [requestId, state] of progressStore.entries()) {
    if (now - Date.parse(state.updatedAt) > ttlMs) {
      progressStore.delete(requestId);
      notificationMetadataStore.delete(requestId);
    }
  }
}

function persistDocumentTranslationNotification(
  progress: TranslationProgressState,
) {
  const notificationId = `document-translation:${progress.requestId}`;
  const existingNotification = getNotificationById(notificationId);
  const metadata = notificationMetadataStore.get(progress.requestId);
  const startedAt = existingNotification?.startedAt ?? progress.updatedAt;
  const completedAt =
    metadata?.completedAt !== undefined
      ? metadata.completedAt
      : progress.phase === "completed" || progress.phase === "failed"
        ? progress.updatedAt
        : null;
  const durationMs =
    metadata?.durationMs !== undefined
      ? metadata.durationMs
      : completedAt && startedAt
        ? Math.max(0, Date.parse(completedAt) - Date.parse(startedAt))
        : existingNotification?.durationMs ?? null;

  upsertNotification({
    id: notificationId,
    kind: "document-translation",
    projectId: null,
    requestId: progress.requestId,
    projectName:
      existingNotification?.projectName ??
      metadata?.fileName ??
      "Document translation",
    providerName:
      metadata?.providerName ?? existingNotification?.providerName ?? null,
    phase: progress.phase,
    message: progress.message,
    progressPercent: progress.progressPercent,
    completedSegments: progress.completedChunks,
    totalSegments: progress.totalChunks,
    unitLabel: "chunks",
    updatedAt: progress.updatedAt,
    startedAt,
    completedAt,
    durationMs,
    downloadUrl:
      metadata?.downloadUrl !== undefined
        ? metadata.downloadUrl
        : existingNotification?.downloadUrl ?? null,
    unread: true,
  });

  if (completedAt) {
    notificationMetadataStore.delete(progress.requestId);
  }
}

export function registerTranslationProgressSocketHandlers(socketServer: SocketIOServer) {
  socketServer.on("connection", (socket) => {
    socket.on("translation-progress:subscribe", (requestId: unknown) => {
      if (typeof requestId !== "string" || requestId.trim().length === 0) {
        return;
      }

      socket.join(requestId);
      const progress = getTranslationProgress(requestId);
      if (progress) {
        socket.emit("translation-progress", progress);
      }
    });

    socket.on("translation-progress:unsubscribe", (requestId: unknown) => {
      if (typeof requestId !== "string" || requestId.trim().length === 0) {
        return;
      }

      socket.leave(requestId);
    });

    Log.debug("Socket client connected for translation progress", {
      socketId: socket.id,
    });
  });
}
