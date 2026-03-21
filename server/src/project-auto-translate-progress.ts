import { Log } from "./logger";
import type { Server as SocketIOServer } from "socket.io";

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
  io?.to(projectId).emit("project-auto-translate-progress", nextState);
}

export function getProjectAutoTranslateProgress(projectId: string) {
  cleanupExpiredProgress();
  return progressStore.get(projectId) ?? null;
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
    }
  }
}
