import { createServer } from "http";
import fs from "fs";
import path from "path";
import cors from "cors";
import express from "express";
import { Server as SocketIOServer } from "socket.io";
import { appConfig } from "./config/app-config";
import { createApiRouter } from "./http/api-router";
import { createDownloadRouter } from "./http/download-router";
import { initializeTranslationMemoryDatabase } from "./translation-memory/database";
import {
  attachProjectAutoTranslateSocket,
  registerProjectAutoTranslateSocketHandlers,
} from "./project-auto-translate-progress";
import {
  attachTranslationProgressSocket,
  registerTranslationProgressSocketHandlers,
} from "./translation-progress";

const app = express();
const httpServer = createServer(app);
const shouldServeClientStatic = process.argv.includes("--serve-static");
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: "*",
  },
});

app.use(
  cors({
    exposedHeaders: ["Content-Disposition"],
  }),
);
app.use(express.json());

initializeTranslationMemoryDatabase();

attachTranslationProgressSocket(io);
attachProjectAutoTranslateSocket(io);
registerTranslationProgressSocketHandlers(io);
registerProjectAutoTranslateSocketHandlers(io);

app.use(createApiRouter());
app.use(createDownloadRouter());

if (shouldServeClientStatic) {
  const clientStaticDir = path.resolve(process.cwd(), "../client/dist");
  const clientIndexPath = path.join(clientStaticDir, "index.html");

  if (fs.existsSync(clientIndexPath)) {
    app.use(express.static(clientStaticDir));
    app.get(/^(?!\/api(?:\/|$)|\/download(?:\/|$)|\/socket\.io(?:\/|$)).*/, (_req, res) => {
      res.sendFile(clientIndexPath);
    });
  } else {
    console.warn(
      `Client build was not found at ${clientIndexPath}. Run the client build before using yarn serve.`,
    );
  }
}

httpServer.listen(appConfig.port, () => {
  console.log(`Server running at http://localhost:${appConfig.port}`);
});
