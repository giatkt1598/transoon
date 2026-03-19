import { type TranslateProgress } from "./translate-provider";
import { Log } from "./logger";
import type { Server as SocketIOServer } from "socket.io";

type TranslationProgressState = TranslateProgress & {
  requestId: string;
  updatedAt: string;
};

const progressStore = new Map<string, TranslationProgressState>();
const ttlMs = 30 * 60 * 1000;
let io: SocketIOServer | null = null;

export function attachTranslationProgressSocket(socketServer: SocketIOServer) {
  io = socketServer;
}

export function setTranslationProgress(
  requestId: string,
  progress: TranslateProgress,
) {
  cleanupExpiredProgress();

  const nextState = {
    requestId,
    ...progress,
    updatedAt: new Date().toISOString(),
  };

  progressStore.set(requestId, nextState);
  io?.to(requestId).emit("translation-progress", nextState);
}

export function getTranslationProgress(requestId: string) {
  cleanupExpiredProgress();
  return progressStore.get(requestId) ?? null;
}

function cleanupExpiredProgress() {
  const now = Date.now();

  for (const [requestId, state] of progressStore.entries()) {
    if (now - Date.parse(state.updatedAt) > ttlMs) {
      progressStore.delete(requestId);
    }
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
