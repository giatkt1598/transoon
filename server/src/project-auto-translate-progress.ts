import { Log } from "./logger";
import type { Server as SocketIOServer } from "socket.io";
import {
  getNotificationById,
  upsertNotification,
} from "./translation-memory/notification-service";

export type ProjectAutoTranslateProgress = {
  projectId: string;
  phase: "queued" | "translating" | "completed" | "failed" | "cancelled";
  completedSegments: number;
  totalSegments: number;
  progressPercent: number;
  message: string;
  updatedAt: string;
};

const progressStore = new Map<string, ProjectAutoTranslateProgress>();
const notificationMetadataStore = new Map<
  string,
  { projectName: string; providerName: string | null }
>();
const ttlMs = 30 * 60 * 1000;
let io: SocketIOServer | null = null;

export function attachProjectAutoTranslateSocket(socketServer: SocketIOServer) {
  io = socketServer;
}

export function setProjectAutoTranslateProgress(
  projectId: string,
  progress: Omit<ProjectAutoTranslateProgress, "projectId" | "updatedAt">,
) {
  cleanupExpiredProgress();

  const nextState: ProjectAutoTranslateProgress = {
    projectId,
    ...progress,
    updatedAt: new Date().toISOString(),
  };

  progressStore.set(projectId, nextState);
  persistProjectAutoTranslateNotification(nextState);
  io?.to(projectId).emit("project-auto-translate-progress", nextState);
}

export function getProjectAutoTranslateProgress(projectId: string) {
  cleanupExpiredProgress();
  return progressStore.get(projectId) ?? null;
}

export function registerProjectAutoTranslateNotificationMetadata(
  projectId: string,
  metadata: {
    projectName: string;
    providerName: string | null;
  },
) {
  notificationMetadataStore.set(projectId, metadata);
}

export function registerProjectAutoTranslateSocketHandlers(
  socketServer: SocketIOServer,
) {
  socketServer.on("connection", (socket) => {
    socket.on("project-auto-translate:subscribe", (projectId: unknown) => {
      if (typeof projectId !== "string" || projectId.trim().length === 0) {
        return;
      }

      socket.join(projectId);
      const progress = getProjectAutoTranslateProgress(projectId);
      if (progress) {
        socket.emit("project-auto-translate-progress", progress);
      }
    });

    socket.on("project-auto-translate:unsubscribe", (projectId: unknown) => {
      if (typeof projectId !== "string" || projectId.trim().length === 0) {
        return;
      }

      socket.leave(projectId);
    });

    Log.debug("Socket client connected for project auto translate progress", {
      socketId: socket.id,
    });
  });
}

function cleanupExpiredProgress() {
  const now = Date.now();

  for (const [projectId, state] of progressStore.entries()) {
    if (now - Date.parse(state.updatedAt) > ttlMs) {
      progressStore.delete(projectId);
      notificationMetadataStore.delete(projectId);
    }
  }
}

function persistProjectAutoTranslateNotification(
  progress: ProjectAutoTranslateProgress,
) {
  const notificationId = `project-auto-translate:${progress.projectId}`;
  const existingNotification = getNotificationById(notificationId);
  const metadata = notificationMetadataStore.get(progress.projectId);
  const startedAt =
    existingNotification?.startedAt ?? progress.updatedAt;
  const completedAt =
    progress.phase === "completed" ||
    progress.phase === "failed" ||
    progress.phase === "cancelled"
      ? progress.updatedAt
      : null;
  const durationMs =
    completedAt && startedAt
      ? Math.max(0, Date.parse(completedAt) - Date.parse(startedAt))
      : existingNotification?.durationMs ?? null;

  upsertNotification({
    id: notificationId,
    kind: "project-auto-translate",
    projectId: progress.projectId,
    requestId: null,
    projectName:
      existingNotification?.projectName ?? metadata?.projectName ?? "Project",
    providerName:
      existingNotification?.providerName ?? metadata?.providerName ?? null,
    phase: progress.phase,
    message: progress.message,
    progressPercent: progress.progressPercent,
    completedSegments: progress.completedSegments,
    totalSegments: progress.totalSegments,
    unitLabel: "segments",
    updatedAt: progress.updatedAt,
    startedAt,
    completedAt,
    durationMs,
    downloadUrl: null,
    unread: true,
  });

  if (completedAt) {
    notificationMetadataStore.delete(progress.projectId);
  }
}
