import { randomUUID } from "crypto";
import { Router } from "express";
import multer from "multer";
import { appConfig } from "../config/app-config";
import { languageCatalog } from "../config/language-catalog";
import { extractDocument } from "../document-service";
import {
  createProject,
  deleteProject,
  generateProjectSegments,
  assertProjectIsEditable,
  getProjectDetailById,
  getProjectById,
  listProjectSegments,
  listProjects,
  saveProjectSegments,
  startProjectAutoTranslate,
  updateProject,
} from "../translation-memory/project-service";
import {
  attachTranslationMemoryToProject,
  createTranslationMemory,
  deleteProjectTranslationMemory,
  deleteTranslationMemory,
  getTranslationMemoryById,
  getProjectTranslationMemory,
  listTranslationMemories,
  updateProjectTranslationMemory,
  updateTranslationMemory,
} from "../translation-memory/translation-memory-service";
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

  router.get("/api/projects", (_req, res) => {
    try {
      res.json({
        projects: listProjects(),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unexpected server error.";
      res.status(500).json({ error: message });
    }
  });

  router.get("/api/projects/:projectId", (req, res) => {
    try {
      const project = getProjectById(String(req.params.projectId));

      if (!project) {
        res.status(404).json({ error: "Project not found." });
        return;
      }

      res.json(project);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unexpected server error.";
      res.status(500).json({ error: message });
    }
  });

  router.get("/api/projects/:projectId/detail", (req, res) => {
    try {
      const project = getProjectDetailById(String(req.params.projectId));

      if (!project) {
        res.status(404).json({ error: "Project not found." });
        return;
      }

      res.json(project);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unexpected server error.";
      res.status(500).json({ error: message });
    }
  });

  router.get("/api/projects/:projectId/segments", (req, res) => {
    try {
      const projectId = String(req.params.projectId);
      const existingProject = getProjectById(projectId);

      if (!existingProject) {
        res.status(404).json({ error: "Project not found." });
        return;
      }

      res.json({
        segments: listProjectSegments(projectId),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unexpected server error.";
      res.status(500).json({ error: message });
    }
  });

  router.put("/api/projects/:projectId/segments", (req, res) => {
    try {
      const projectId = String(req.params.projectId);
      const existingProject = getProjectById(projectId);

      if (!existingProject) {
        res.status(404).json({ error: "Project not found." });
        return;
      }

      assertProjectIsEditable(projectId);
      const validationError = validateProjectSegmentsInput(req.body);
      if (validationError) {
        res.status(400).json({ error: validationError });
        return;
      }

      const result = saveProjectSegments(projectId, req.body.segments);
      res.json(result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unexpected server error.";
      res.status(500).json({ error: message });
    }
  });

  router.post("/api/projects", upload.single("file"), (req, res) => {
    try {
      const validationError = validateProjectInput(req.body);
      if (validationError) {
        res.status(400).json({ error: validationError });
        return;
      }

      const project = createProject(req.body, {
        documentFile: req.file
          ? {
              originalName: req.file.originalname,
              buffer: req.file.buffer,
            }
          : undefined,
      });
      res.status(201).json(project);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unexpected server error.";
      res.status(500).json({ error: message });
    }
  });

  router.put("/api/projects/:projectId", (req, res) => {
    try {
      const projectId = String(req.params.projectId);
      const existingProject = getProjectById(projectId);

      if (!existingProject) {
        res.status(404).json({ error: "Project not found." });
        return;
      }

      const validationError = validateProjectInput(req.body);
      if (validationError) {
        res.status(400).json({ error: validationError });
        return;
      }

      assertProjectIsEditable(projectId);
      const project = updateProject(projectId, req.body);
      res.json(project);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unexpected server error.";
      res.status(500).json({ error: message });
    }
  });

  router.delete("/api/projects/:projectId", (req, res) => {
    try {
      const projectId = String(req.params.projectId);
      const existingProject = getProjectById(projectId);

      if (!existingProject) {
        res.status(404).json({ error: "Project not found." });
        return;
      }

      assertProjectIsEditable(projectId);
      deleteProject(projectId);
      res.status(204).send();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unexpected server error.";
      res.status(500).json({ error: message });
    }
  });

  router.post("/api/projects/:projectId/generate-segments", async (req, res) => {
    try {
      const projectId = String(req.params.projectId);
      const existingProject = getProjectById(projectId);

      if (!existingProject) {
        res.status(404).json({ error: "Project not found." });
        return;
      }

      assertProjectIsEditable(projectId);
      const result = await generateProjectSegments(projectId);
      res.json(result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unexpected server error.";
      res.status(500).json({ error: message });
    }
  });

  router.post("/api/projects/:projectId/translation-memories", (req, res) => {
    try {
      const projectId = String(req.params.projectId);
      const existingProject = getProjectById(projectId);

      if (!existingProject) {
        res.status(404).json({ error: "Project not found." });
        return;
      }

      assertProjectIsEditable(projectId);
      const validationError = validateProjectTranslationMemoryInput(req.body);
      if (validationError) {
        res.status(400).json({ error: validationError });
        return;
      }

      const translationMemory = getTranslationMemoryById(
        String(req.body.translationMemoryId),
      );
      if (!translationMemory) {
        res.status(404).json({ error: "Translation memory not found." });
        return;
      }

      const created = attachTranslationMemoryToProject({
        projectId,
        translationMemoryId: String(req.body.translationMemoryId),
        accessMode: req.body.accessMode,
        priority: Number(req.body.priority),
      });
      res.status(201).json(created);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unexpected server error.";
      res.status(500).json({ error: message });
    }
  });

  router.put(
    "/api/projects/:projectId/translation-memories/:translationMemoryId",
    (req, res) => {
      try {
        const projectId = String(req.params.projectId);
        const translationMemoryId = String(req.params.translationMemoryId);

        const existingProject = getProjectById(projectId);
        if (!existingProject) {
          res.status(404).json({ error: "Project not found." });
          return;
        }

        assertProjectIsEditable(projectId);
        const existingLink = getProjectTranslationMemory(
          projectId,
          translationMemoryId,
        );
        if (!existingLink) {
          res
            .status(404)
            .json({ error: "Project translation memory configuration not found." });
          return;
        }

        const validationError = validateProjectTranslationMemoryInput({
          ...req.body,
          translationMemoryId,
        });
        if (validationError) {
          res.status(400).json({ error: validationError });
          return;
        }

        const updated = updateProjectTranslationMemory({
          projectId,
          translationMemoryId,
          accessMode: req.body.accessMode,
          priority: Number(req.body.priority),
        });
        res.json(updated);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unexpected server error.";
        res.status(500).json({ error: message });
      }
    },
  );

  router.delete(
    "/api/projects/:projectId/translation-memories/:translationMemoryId",
    (req, res) => {
      try {
        const projectId = String(req.params.projectId);
        const translationMemoryId = String(req.params.translationMemoryId);

        const existingProject = getProjectById(projectId);
        if (!existingProject) {
          res.status(404).json({ error: "Project not found." });
          return;
        }

        assertProjectIsEditable(projectId);
        const existingLink = getProjectTranslationMemory(
          projectId,
          translationMemoryId,
        );
        if (!existingLink) {
          res
            .status(404)
            .json({ error: "Project translation memory configuration not found." });
          return;
        }

        deleteProjectTranslationMemory(projectId, translationMemoryId);
        res.status(204).send();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unexpected server error.";
        res.status(500).json({ error: message });
      }
    },
  );

  router.post("/api/projects/:projectId/auto-translate", async (req, res) => {
    try {
      const projectId = String(req.params.projectId);
      const existingProject = getProjectById(projectId);

      if (!existingProject) {
        res.status(404).json({ error: "Project not found." });
        return;
      }

      const providerName = String(
        req.body?.providerName ?? appConfig.defaultTranslateProvider,
      );
      const project = await startProjectAutoTranslate(projectId, providerName);
      res.status(202).json({
        message: "Auto translate started.",
        project,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unexpected server error.";
      res.status(500).json({ error: message });
    }
  });

  router.get("/api/translation-memories", (_req, res) => {
    try {
      res.json({
        translationMemories: listTranslationMemories(),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unexpected server error.";
      res.status(500).json({ error: message });
    }
  });

  router.get("/api/translation-memories/:translationMemoryId", (req, res) => {
    try {
      const translationMemory = getTranslationMemoryById(
        String(req.params.translationMemoryId),
      );

      if (!translationMemory) {
        res.status(404).json({ error: "Translation memory not found." });
        return;
      }

      res.json(translationMemory);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unexpected server error.";
      res.status(500).json({ error: message });
    }
  });

  router.post("/api/translation-memories", (req, res) => {
    try {
      const validationError = validateTranslationMemoryInput(req.body);
      if (validationError) {
        res.status(400).json({ error: validationError });
        return;
      }

      const translationMemory = createTranslationMemory(req.body);
      res.status(201).json(translationMemory);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unexpected server error.";
      res.status(500).json({ error: message });
    }
  });

  router.put("/api/translation-memories/:translationMemoryId", (req, res) => {
    try {
      const translationMemoryId = String(req.params.translationMemoryId);
      const existingTranslationMemory = getTranslationMemoryById(
        translationMemoryId,
      );

      if (!existingTranslationMemory) {
        res.status(404).json({ error: "Translation memory not found." });
        return;
      }

      const validationError = validateTranslationMemoryInput(req.body);
      if (validationError) {
        res.status(400).json({ error: validationError });
        return;
      }

      const translationMemory = updateTranslationMemory(
        translationMemoryId,
        req.body,
      );
      res.json(translationMemory);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unexpected server error.";
      res.status(500).json({ error: message });
    }
  });

  router.delete("/api/translation-memories/:translationMemoryId", (req, res) => {
    try {
      const translationMemoryId = String(req.params.translationMemoryId);
      const existingTranslationMemory = getTranslationMemoryById(
        translationMemoryId,
      );

      if (!existingTranslationMemory) {
        res.status(404).json({ error: "Translation memory not found." });
        return;
      }

      deleteTranslationMemory(translationMemoryId);
      res.status(204).send();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unexpected server error.";
      res.status(500).json({ error: message });
    }
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

function validateProjectInput(body: unknown) {
  if (!body || typeof body !== "object") {
    return "A project payload is required.";
  }

  const { name, sourceLang, targetLang, description } = body as Record<string, unknown>;

  if (typeof name !== "string" || name.trim().length === 0) {
    return "Project name is required.";
  }

  if (typeof sourceLang !== "string" || sourceLang.trim().length === 0) {
    return "Source language is required.";
  }

  if (typeof targetLang !== "string" || targetLang.trim().length === 0) {
    return "Target language is required.";
  }

  if (description !== undefined && typeof description !== "string") {
    return "Description must be a string.";
  }

  return null;
}

function validateProjectSegmentsInput(body: unknown) {
  if (!body || typeof body !== "object") {
    return "A project segments payload is required.";
  }

  const { segments } = body as Record<string, unknown>;
  if (!Array.isArray(segments)) {
    return "Segments must be an array.";
  }

  for (const segment of segments) {
    if (!segment || typeof segment !== "object") {
      return "Each segment must be an object.";
    }

    const { id, targetText } = segment as Record<string, unknown>;
    if (typeof id !== "string" || id.trim().length === 0) {
      return "Each segment must include a valid id.";
    }

    if (typeof targetText !== "string") {
      return "Each segment must include targetText as a string.";
    }
  }

  return null;
}

function validateTranslationMemoryInput(body: unknown) {
  if (!body || typeof body !== "object") {
    return "A translation memory payload is required.";
  }

  const { name, sourceLanguage, targetLanguage } = body as Record<string, unknown>;

  if (typeof name !== "string" || name.trim().length === 0) {
    return "Translation memory name is required.";
  }

  if (
    typeof sourceLanguage !== "string" ||
    sourceLanguage.trim().length === 0
  ) {
    return "Source language is required.";
  }

  if (
    typeof targetLanguage !== "string" ||
    targetLanguage.trim().length === 0
  ) {
    return "Target language is required.";
  }

  return null;
}

function validateProjectTranslationMemoryInput(body: unknown) {
  if (!body || typeof body !== "object") {
    return "A project translation memory payload is required.";
  }

  const { translationMemoryId, accessMode, priority } = body as Record<
    string,
    unknown
  >;

  if (
    typeof translationMemoryId !== "string" ||
    translationMemoryId.trim().length === 0
  ) {
    return "Translation memory is required.";
  }

  if (accessMode !== "read" && accessMode !== "write") {
    return "Access mode must be read or write.";
  }

  if (
    typeof priority !== "number" &&
    !(typeof priority === "string" && priority.trim().length > 0)
  ) {
    return "Priority is required.";
  }

  const numericPriority = Number(priority);
  if (!Number.isInteger(numericPriority) || numericPriority < 0) {
    return "Priority must be a non-negative integer.";
  }

  return null;
}
