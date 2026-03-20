import { randomUUID } from "crypto";
import { Router } from "express";
import multer from "multer";
import { appConfig } from "../config/app-config";
import { languageCatalog } from "../config/language-catalog";
import { extractDocument } from "../document-service";
import { TranslateProvider } from "../translation-service";
import { translateDocument } from "../translation/document-translation-service";
import { getTranslationProgress, setTranslationProgress } from "../translation-progress";

const upload = multer({ storage: multer.memoryStorage() });

export function createApiRouter() {
  const router = Router();

  router.get("/", (_req, res) => {
    res.json({
      name: "transoon-server",
      status: "ok",
    });
  });

  router.get("/api/languages", (_req, res) => {
    res.json(languageCatalog);
  });

  router.get("/api/translate-providers", (_req, res) => {
    res.json({
      defaultTranslateProvider: appConfig.defaultTranslateProvider,
      translateProviders: TranslateProvider.list(),
    });
  });

  router.get("/api/translation-progress/:requestId", (req, res) => {
    const requestId = String(req.params.requestId);
    const progress = getTranslationProgress(requestId);

    if (!progress) {
      res.status(404).json({ error: "Translation progress not found." });
      return;
    }

    res.json(progress);
  });

  router.post(
    "/api/translate-providers/:providerName/prompt-preview",
    upload.single("file"),
    async (req, res) => {
      try {
        const providerName = String(req.params.providerName);
        const sourceLanguage = String(
          req.body.sourceLanguage ?? appConfig.defaultSourceLanguage,
        );
        const targetLanguage = String(
          req.body.targetLanguage ?? appConfig.defaultTargetLanguage,
        );
        const file = req.file;

        if (!file) {
          res
            .status(400)
            .json({ error: "A document file is required to preview buildPrompt." });
          return;
        }

        const extractedDocument = await extractDocument(
          file.originalname,
          file.buffer,
        );
        const preview = TranslateProvider.resolve(providerName).getPromptPreview({
          segments: extractedDocument.segments.map((segment) => segment.text),
          sourceLanguage,
          targetLanguage,
        });

        if (preview.supported && !preview.content) {
          res.status(400).json({
            error:
              "The selected document does not contain any non-empty text chunk to preview.",
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
    },
  );

  router.post(
    "/api/translate-document",
    upload.single("file"),
    async (req, res) => {
      const requestId = String(req.body.requestId ?? randomUUID());

      try {
        const sourceLanguage = String(
          req.body.sourceLanguage ?? appConfig.defaultSourceLanguage,
        );
        const targetLanguage = String(
          req.body.targetLanguage ?? appConfig.defaultTargetLanguage,
        );
        const providerName = String(
          req.body.providerName ?? appConfig.defaultTranslateProvider,
        );
        const file = req.file;

        if (!file) {
          res.status(400).json({ error: "A document file is required." });
          return;
        }

        const result = await translateDocument({
          requestId,
          fileName: file.originalname,
          fileBuffer: file.buffer,
          sourceLanguage,
          targetLanguage,
          providerName,
          onProgress: (progress) => setTranslationProgress(requestId, progress),
        });

        res.json(result);
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
    },
  );

  return router;
}
