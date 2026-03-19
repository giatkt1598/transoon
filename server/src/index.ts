import { randomUUID } from "crypto";
import { createServer } from "http";
import { promises as fs } from "fs";
import path from "path";
import cors from "cors";
import express from "express";
import multer from "multer";
import { Server as SocketIOServer } from "socket.io";
import { extractDocument, writeOutputFile } from "./document-service";
import {
  attachTranslationProgressSocket,
  getTranslationProgress,
  registerTranslationProgressSocketHandlers,
  setTranslationProgress,
} from "./translation-progress";
import { TranslateProvider, translateSegments } from "./translation-service";

const app = express();
const PORT = 3000;
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: "*",
  },
});
const upload = multer({ storage: multer.memoryStorage() });
const outputDirectory = path.resolve(process.cwd(), "storage", "outputs");

app.use(cors());
app.use(express.json());

attachTranslationProgressSocket(io);
registerTranslationProgressSocketHandlers(io);

app.get("/", (_req, res) => {
  res.json({
    name: "transoon-server",
    status: "ok",
  });
});

app.get("/api/languages", (_req, res) => {
  res.json({
    defaultSourceLanguage: "en",
    defaultTargetLanguage: "ja",
    defaultTranslateProvider: "Google Translate",
    languages: [
      { code: "auto", label: "Auto detect" },
      { code: "en", label: "English" },
      { code: "ja", label: "Japanese" },
      { code: "vi", label: "Vietnamese" },
      { code: "zh-CN", label: "Chinese (Simplified)" },
      { code: "ko", label: "Korean" },
      { code: "fr", label: "French" },
      { code: "de", label: "German" },
      { code: "es", label: "Spanish" },
    ],
  });
});

app.get("/api/translate-providers", (_req, res) => {
  res.json({
    defaultTranslateProvider: "Google Translate",
    translateProviders: TranslateProvider.list(),
  });
});

app.get("/api/translation-progress/:requestId", (req, res) => {
  const requestId = String(req.params.requestId);
  const progress = getTranslationProgress(requestId);

  if (!progress) {
    res.status(404).json({ error: "Translation progress not found." });
    return;
  }

  res.json(progress);
});

app.post(
  "/api/translate-providers/:providerName/prompt-preview",
  upload.single("file"),
  async (req, res) => {
  try {
    const providerName = String(req.params.providerName);
    const sourceLanguage = String(req.body.sourceLanguage ?? "en");
    const targetLanguage = String(req.body.targetLanguage ?? "ja");
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: "A document file is required to preview buildPrompt." });
      return;
    }

    const extractedDocument = await extractDocument(file.originalname, file.buffer);
    const preview = TranslateProvider.resolve(providerName).getPromptPreview({
      segments: extractedDocument.segments.map((segment) => segment.text),
      sourceLanguage,
      targetLanguage,
    });

    if (preview.supported && !preview.content) {
      res.status(400).json({
        error: "The selected document does not contain any non-empty text chunk to preview.",
      });
      return;
    }

    res.json({
      providerName,
      sourceLanguage,
      targetLanguage,
      ...preview,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error.";
    res.status(500).json({ error: message });
  }
});

app.post("/api/translate-document", upload.single("file"), async (req, res) => {
  const startedAt = performance.now();
  const requestId = String(req.body.requestId ?? randomUUID());

  try {
    const sourceLanguage = String(req.body.sourceLanguage ?? "en");
    const targetLanguage = String(req.body.targetLanguage ?? "ja");
    const providerName = String(req.body.providerName ?? "Google Translate");
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: "A document file is required." });
      return;
    }

    setTranslationProgress(requestId, {
      phase: "extracting",
      totalChunks: 0,
      completedChunks: 0,
      progressPercent: 5,
      message: "Extracting text from document.",
    });

    const extractedDocument = await extractDocument(file.originalname, file.buffer);
    const { translatedSegments, warnings, provider } = await translateSegments(
      extractedDocument.segments.map((segment) => segment.text),
      sourceLanguage === "auto" ? "auto" : sourceLanguage,
      targetLanguage,
      providerName,
      (progress) =>
        setTranslationProgress(requestId, {
          ...progress,
          progressPercent: Math.max(
            10,
            Math.min(90, Math.round(10 + progress.progressPercent * 0.8)),
          ),
        }),
    );

    setTranslationProgress(requestId, {
      phase: "merging",
      totalChunks: 0,
      completedChunks: 0,
      progressPercent: 92,
      message: "Merging translated text back into the document.",
    });

    const outputBuffer = await extractedDocument.replaceSegments(translatedSegments);
    const { outputFileName } = await writeOutputFile(file.originalname, outputBuffer);

    setTranslationProgress(requestId, {
      phase: "completed",
      totalChunks: 0,
      completedChunks: 0,
      progressPercent: 100,
      message: "Translation completed.",
    });

    res.json({
      requestId,
      sourceLanguage,
      targetLanguage,
      providerName,
      documentType: extractedDocument.documentType,
      originalFileName: file.originalname,
      outputFileName,
      provider,
      warnings,
      segmentCount: extractedDocument.segments.length,
      processingTimeMs: Math.round(performance.now() - startedAt),
      preview: translatedSegments.filter((segment) => segment.trim().length > 0).slice(0, 8),
      downloadUrl: `http://localhost:${PORT}/api/downloads/${outputFileName}`,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error.";
    setTranslationProgress(requestId, {
      phase: "failed",
      totalChunks: 0,
      completedChunks: 0,
      progressPercent: 100,
      message,
    });
    res.status(500).json({ error: message });
  }
});

app.get("/api/downloads/:fileName", async (req, res) => {
  const fileName = path.basename(req.params.fileName);
  const filePath = path.join(outputDirectory, fileName);

  try {
    await fs.access(filePath);
    res.download(filePath, fileName);
  } catch {
    res.status(404).json({ error: "Output file not found." });
  }
});

httpServer.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
