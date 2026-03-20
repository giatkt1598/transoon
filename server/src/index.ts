import { createServer } from "http";
import cors from "cors";
import express from "express";
import { Server as SocketIOServer } from "socket.io";
import { appConfig } from "./config/app-config";
import { createApiRouter } from "./http/api-router";
import { createDownloadRouter } from "./http/download-router";
import { initializeTranslationMemoryDatabase } from "./translation-memory/database";
import {
  attachTranslationProgressSocket,
  registerTranslationProgressSocketHandlers,
} from "./translation-progress";

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: "*",
  },
});

app.use(cors());
app.use(express.json());

initializeTranslationMemoryDatabase();

attachTranslationProgressSocket(io);
registerTranslationProgressSocketHandlers(io);

app.use(createApiRouter());
app.use(createDownloadRouter());

httpServer.listen(appConfig.port, () => {
  console.log(`Server running at http://localhost:${appConfig.port}`);
});
