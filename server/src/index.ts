import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import cors from "cors";
import express from "express";
import multer from "multer";
import { extractDocument, writeOutputFile } from "./document-service";
import { translateSegments } from "./translation-service";

const app = express();
const PORT = 3000;
const upload = multer({ storage: multer.memoryStorage() });
const outputDirectory = path.resolve(process.cwd(), "storage", "outputs");

app.use(cors());
app.use(express.json());

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
    translateProviders: ["Google Translate", "DeepSeek r1"],
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

app.post("/api/translate-document", upload.single("file"), async (req, res) => {
  try {
    const sourceLanguage = String(req.body.sourceLanguage ?? "en");
    const targetLanguage = String(req.body.targetLanguage ?? "ja");
    const providerName = String(req.body.providerName ?? "Google Translate");
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: "A document file is required." });
      return;
    }

    const extractedDocument = await extractDocument(file.originalname, file.buffer);
    const { translatedSegments, warnings, provider } = await translateSegments(
      extractedDocument.segments.map((segment) => segment.text),
      sourceLanguage === "auto" ? "auto" : sourceLanguage,
      targetLanguage,
      providerName,
    );

    const outputBuffer = await extractedDocument.replaceSegments(translatedSegments);
    const { outputFileName } = await writeOutputFile(file.originalname, outputBuffer);

    res.json({
      requestId: randomUUID(),
      sourceLanguage,
      targetLanguage,
      providerName,
      documentType: extractedDocument.documentType,
      originalFileName: file.originalname,
      outputFileName,
      provider,
      warnings,
      segmentCount: extractedDocument.segments.length,
      preview: translatedSegments.filter((segment) => segment.trim().length > 0).slice(0, 8),
      downloadUrl: `http://localhost:${PORT}/api/downloads/${outputFileName}`,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error.";
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

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
