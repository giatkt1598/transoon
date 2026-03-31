import { randomUUID } from "crypto";
import { Router } from "express";
import multer from "multer";
import { appConfig } from "../config/app-config";
import { languageCatalog } from "../config/language-catalog";
import { extractDocument } from "../document-service";
import {
  cancelProjectAutoTranslate,
  confirmProjectSegment,
  createProject,
  deleteProject,
  generateProjectSegments,
  assertProjectIsEditable,
  getProjectDetailById,
  getProjectById,
  listProjectSegments,
  listProjects,
  exportProjectDocument,
  downloadProjectSourceDocument,
  getProjectDocumentPreview,
  saveProjectSegments,
  mergeProjectSegments,
  splitProjectSegment,
  startProjectAutoTranslate,
  inlineTranslateProjectSegment,
  updateProject,
} from "../translation-memory/project-service";
import {
  attachGlossaryToProject,
  createGlossary,
  createGlossaryItem,
  deleteGlossary,
  deleteGlossaryItem,
  deleteProjectGlossary,
  getGlossaryById,
  getProjectGlossary,
  listGlossaries,
  listGlossaryItems,
  listProjectGlossaries,
  saveGlossaryItemsChanges,
  updateGlossary,
  updateProjectGlossary,
  updateGlossaryItem,
} from "../translation-memory/glossary-service";
import {
  attachTranslationMemoryToProject,
  createTranslationMemory,
  deleteTranslationMemoryTerm,
  deleteProjectTranslationMemory,
  deleteTranslationMemory,
  getTranslationMemoryById,
  getProjectTranslationMemory,
  listTranslationMemoryTerms,
  listProjectTerms,
  listTranslationMemories,
  saveTranslationMemoryTermsChanges,
  updateTranslationMemoryTerm,
  updateProjectTranslationMemory,
  updateTranslationMemory,
} from "../translation-memory/translation-memory-service";
import { getAppSettings, updateAppSettings } from "../translation-memory/settings-service";
import {
  clearAllNotifications,
  listNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "../translation-memory/notification-service";
import { TranslateProvider } from "../translation-service";
import { translateDocument } from "../translation/document-translation-service";
import {
  getTranslationProgress,
  registerTranslationNotificationMetadata,
  setTranslationProgress,
} from "../translation-progress";

const upload = multer({ storage: multer.memoryStorage() });

export function createApiRouter() {
  const router = Router();
  const shouldServeClientStatic = process.env.SERVE_STATIC === "true" || process.argv.includes("--serve-static");

  if (!shouldServeClientStatic) {
    router.get("/", (_req, res) => {
      res.json({
        name: "transoon-server",
        status: "ok",
      });
    });
  }

  router.get("/api/languages", (_req, res) => {
    res.json(languageCatalog);
  });

  router.get("/api/translate-providers", (_req, res) => {
    res.json({
      defaultTranslateProvider: appConfig.defaultTranslateProvider,
      translateProviders: TranslateProvider.list(),
    });
  });

  router.get("/api/settings", (_req, res) => {
    try {
      res.json(getAppSettings());
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected server error.";
      res.status(500).json({ error: message });
    }
  });

  router.put("/api/settings", (req, res) => {
    try {
      const validationError = validateSettingsInput(req.body);
      if (validationError) {
        res.status(400).json({ error: validationError });
        return;
      }

      res.json(updateAppSettings(req.body));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected server error.";
      res.status(500).json({ error: message });
    }
  });

  router.get("/api/projects", (_req, res) => {
    try {
      res.json({
        projects: listProjects(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected server error.";
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
      const message = error instanceof Error ? error.message : "Unexpected server error.";
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
      const message = error instanceof Error ? error.message : "Unexpected server error.";
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
      const message = error instanceof Error ? error.message : "Unexpected server error.";
      res.status(500).json({ error: message });
    }
  });

  router.get("/api/projects/:projectId/terms", (req, res) => {
    try {
      const projectId = String(req.params.projectId);
      const existingProject = getProjectById(projectId);

      if (!existingProject) {
        res.status(404).json({ error: "Project not found." });
        return;
      }

      res.json({
        terms: listProjectTerms(projectId),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected server error.";
      res.status(500).json({ error: message });
    }
  });

  router.get("/api/projects/:projectId/document-preview", async (req, res) => {
    try {
      const projectId = String(req.params.projectId);
      const existingProject = getProjectById(projectId);

      if (!existingProject) {
        res.status(404).json({ error: "Project not found." });
        return;
      }

      const preview = await getProjectDocumentPreview(projectId);
      res.json(preview);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected server error.";
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
      const message = error instanceof Error ? error.message : "Unexpected server error.";
      res.status(500).json({ error: message });
    }
  });

  router.post("/api/projects/:projectId/segments/merge", async (req, res) => {
    try {
      const projectId = String(req.params.projectId);
      const existingProject = getProjectById(projectId);

      if (!existingProject) {
        res.status(404).json({ error: "Project not found." });
        return;
      }

      assertProjectIsEditable(projectId);
      const validationError = validateMergeProjectSegmentsInput(req.body);
      if (validationError) {
        res.status(400).json({ error: validationError });
        return;
      }

      const result = await mergeProjectSegments(projectId, req.body.segmentIds);
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected server error.";
      res.status(500).json({ error: message });
    }
  });

  router.post("/api/projects/:projectId/segments/:segmentId/split", async (req, res) => {
    try {
      const projectId = String(req.params.projectId);
      const segmentId = String(req.params.segmentId);
      const existingProject = getProjectById(projectId);

      if (!existingProject) {
        res.status(404).json({ error: "Project not found." });
        return;
      }

      assertProjectIsEditable(projectId);
      const validationError = validateSplitProjectSegmentInput(req.body);
      if (validationError) {
        res.status(400).json({ error: validationError });
        return;
      }

      const result = await splitProjectSegment(projectId, segmentId, req.body.splitIndex);
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected server error.";
      res.status(500).json({ error: message });
    }
  });

  router.post("/api/projects/:projectId/segments/:segmentId/inline-translate", async (req, res) => {
    try {
      const projectId = String(req.params.projectId);
      const segmentId = String(req.params.segmentId);
      const existingProject = getProjectById(projectId);

      if (!existingProject) {
        res.status(404).json({ error: "Project not found." });
        return;
      }

      const result = await inlineTranslateProjectSegment(projectId, segmentId);
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected server error.";
      res.status(500).json({ error: message });
    }
  });

  router.post("/api/projects/:projectId/segments/:segmentId/confirm", (req, res) => {
    try {
      const projectId = String(req.params.projectId);
      const segmentId = String(req.params.segmentId);
      const existingProject = getProjectById(projectId);

      if (!existingProject) {
        res.status(404).json({ error: "Project not found." });
        return;
      }

      const targetText = typeof req.body?.targetText === "string" ? req.body.targetText : undefined;
      const result = confirmProjectSegment(projectId, segmentId, targetText);
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected server error.";
      res.status(500).json({ error: message });
    }
  });

  router.post("/api/projects", upload.single("file"), async (req, res) => {
    try {
      const validationError = validateProjectInput(req.body);
      if (validationError) {
        res.status(400).json({ error: validationError });
        return;
      }

      const project = await createProject(req.body, {
        documentFile: req.file
          ? {
              originalName: req.file.originalname,
              buffer: req.file.buffer,
            }
          : undefined,
      });
      res.status(201).json(project);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected server error.";
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
      const message = error instanceof Error ? error.message : "Unexpected server error.";
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
      const message = error instanceof Error ? error.message : "Unexpected server error.";
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
      const message = error instanceof Error ? error.message : "Unexpected server error.";
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

      const translationMemory = getTranslationMemoryById(String(req.body.translationMemoryId));
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
      const message = error instanceof Error ? error.message : "Unexpected server error.";
      res.status(500).json({ error: message });
    }
  });

  router.put("/api/projects/:projectId/translation-memories/:translationMemoryId", (req, res) => {
    try {
      const projectId = String(req.params.projectId);
      const translationMemoryId = String(req.params.translationMemoryId);

      const existingProject = getProjectById(projectId);
      if (!existingProject) {
        res.status(404).json({ error: "Project not found." });
        return;
      }

      assertProjectIsEditable(projectId);
      const existingLink = getProjectTranslationMemory(projectId, translationMemoryId);
      if (!existingLink) {
        res.status(404).json({
          error: "Project translation memory configuration not found.",
        });
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
      const message = error instanceof Error ? error.message : "Unexpected server error.";
      res.status(500).json({ error: message });
    }
  });

  router.delete("/api/projects/:projectId/translation-memories/:translationMemoryId", (req, res) => {
    try {
      const projectId = String(req.params.projectId);
      const translationMemoryId = String(req.params.translationMemoryId);

      const existingProject = getProjectById(projectId);
      if (!existingProject) {
        res.status(404).json({ error: "Project not found." });
        return;
      }

      assertProjectIsEditable(projectId);
      const existingLink = getProjectTranslationMemory(projectId, translationMemoryId);
      if (!existingLink) {
        res.status(404).json({
          error: "Project translation memory configuration not found.",
        });
        return;
      }

      deleteProjectTranslationMemory(projectId, translationMemoryId);
      res.status(204).send();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected server error.";
      res.status(500).json({ error: message });
    }
  });

  router.post("/api/projects/:projectId/glossaries", (req, res) => {
    try {
      const projectId = String(req.params.projectId);
      const existingProject = getProjectById(projectId);

      if (!existingProject) {
        res.status(404).json({ error: "Project not found." });
        return;
      }

      assertProjectIsEditable(projectId);
      const validationError = validateProjectGlossaryInput(req.body);
      if (validationError) {
        res.status(400).json({ error: validationError });
        return;
      }

      const glossary = getGlossaryById(String(req.body.glossaryId));
      if (!glossary) {
        res.status(404).json({ error: "Glossary not found." });
        return;
      }

      const created = attachGlossaryToProject({
        projectId,
        glossaryId: String(req.body.glossaryId),
        priority: Number(req.body.priority),
      });
      res.status(201).json(created);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected server error.";
      res.status(500).json({ error: message });
    }
  });

  router.put("/api/projects/:projectId/glossaries/:glossaryId", (req, res) => {
    try {
      const projectId = String(req.params.projectId);
      const glossaryId = String(req.params.glossaryId);
      const existingProject = getProjectById(projectId);
      if (!existingProject) {
        res.status(404).json({ error: "Project not found." });
        return;
      }

      assertProjectIsEditable(projectId);
      const existingLink = getProjectGlossary(projectId, glossaryId);
      if (!existingLink) {
        res.status(404).json({
          error: "Project glossary configuration not found.",
        });
        return;
      }

      const validationError = validateProjectGlossaryInput({
        ...req.body,
        glossaryId,
      });
      if (validationError) {
        res.status(400).json({ error: validationError });
        return;
      }

      const updated = updateProjectGlossary({
        projectId,
        glossaryId,
        priority: Number(req.body.priority),
      });
      res.json(updated);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected server error.";
      res.status(500).json({ error: message });
    }
  });

  router.delete("/api/projects/:projectId/glossaries/:glossaryId", (req, res) => {
    try {
      const projectId = String(req.params.projectId);
      const glossaryId = String(req.params.glossaryId);
      const existingProject = getProjectById(projectId);
      if (!existingProject) {
        res.status(404).json({ error: "Project not found." });
        return;
      }

      assertProjectIsEditable(projectId);
      const existingLink = getProjectGlossary(projectId, glossaryId);
      if (!existingLink) {
        res.status(404).json({
          error: "Project glossary configuration not found.",
        });
        return;
      }

      deleteProjectGlossary(projectId, glossaryId);
      res.status(204).send();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected server error.";
      res.status(500).json({ error: message });
    }
  });

  router.post("/api/projects/:projectId/auto-translate", async (req, res) => {
    try {
      const projectId = String(req.params.projectId);
      const existingProject = getProjectById(projectId);

      if (!existingProject) {
        res.status(404).json({ error: "Project not found." });
        return;
      }

      const providerName = String(req.body?.providerName ?? appConfig.defaultTranslateProvider);
      const project = await startProjectAutoTranslate(projectId, providerName);
      res.status(202).json({
        message: "Auto translate started.",
        project,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected server error.";
      res.status(500).json({ error: message });
    }
  });

  router.post("/api/projects/:projectId/auto-translate/cancel", (req, res) => {
    try {
      const projectId = String(req.params.projectId);
      const existingProject = getProjectById(projectId);

      if (!existingProject) {
        res.status(404).json({ error: "Project not found." });
        return;
      }

      const project = cancelProjectAutoTranslate(projectId);
      res.json({
        message: "Auto translate cancelled.",
        project,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected server error.";
      res.status(500).json({ error: message });
    }
  });

  router.get("/api/projects/:projectId/export", async (req, res) => {
    try {
      const projectId = String(req.params.projectId);
      const existingProject = getProjectById(projectId);

      if (!existingProject) {
        res.status(404).json({ error: "Project not found." });
        return;
      }

      const { outputPath, downloadFileName } = await exportProjectDocument(projectId);
      res.download(outputPath, downloadFileName);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected server error.";
      res.status(500).json({ error: message });
    }
  });

  router.get("/api/notifications", (_req, res) => {
    try {
      res.json({
        notifications: listNotifications(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected server error.";
      res.status(500).json({ error: message });
    }
  });

  router.post("/api/notifications/:notificationId/read", (req, res) => {
    try {
      markNotificationAsRead(String(req.params.notificationId));
      res.json({ success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected server error.";
      res.status(500).json({ error: message });
    }
  });

  router.post("/api/notifications/read-all", (_req, res) => {
    try {
      markAllNotificationsAsRead();
      res.json({ success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected server error.";
      res.status(500).json({ error: message });
    }
  });

  router.delete("/api/notifications", (_req, res) => {
    try {
      clearAllNotifications();
      res.json({ success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected server error.";
      res.status(500).json({ error: message });
    }
  });

  router.get("/api/projects/:projectId/document", (req, res) => {
    try {
      const projectId = String(req.params.projectId);
      const existingProject = getProjectById(projectId);

      if (!existingProject) {
        res.status(404).json({ error: "Project not found." });
        return;
      }

      const { filePath, downloadFileName } = downloadProjectSourceDocument(projectId);
      res.download(filePath, downloadFileName);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected server error.";
      res.status(500).json({ error: message });
    }
  });

  router.get("/api/translation-memories", (_req, res) => {
    try {
      res.json({
        translationMemories: listTranslationMemories(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected server error.";
      res.status(500).json({ error: message });
    }
  });

  router.get("/api/translation-memories/:translationMemoryId", (req, res) => {
    try {
      const translationMemory = getTranslationMemoryById(String(req.params.translationMemoryId));

      if (!translationMemory) {
        res.status(404).json({ error: "Translation memory not found." });
        return;
      }

      res.json(translationMemory);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected server error.";
      res.status(500).json({ error: message });
    }
  });

  router.get("/api/translation-memories/:translationMemoryId/terms", (req, res) => {
    try {
      const translationMemoryId = String(req.params.translationMemoryId);
      const translationMemory = getTranslationMemoryById(translationMemoryId);

      if (!translationMemory) {
        res.status(404).json({ error: "Translation memory not found." });
        return;
      }

      res.json({
        terms: listTranslationMemoryTerms(translationMemoryId),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected server error.";
      res.status(500).json({ error: message });
    }
  });

  router.put("/api/translation-memories/:translationMemoryId/terms", (req, res) => {
    try {
      const translationMemoryId = String(req.params.translationMemoryId);
      const translationMemory = getTranslationMemoryById(translationMemoryId);

      if (!translationMemory) {
        res.status(404).json({ error: "Translation memory not found." });
        return;
      }

      const validationError = validateTranslationMemoryTermsChangesInput(req.body);
      if (validationError) {
        res.status(400).json({ error: validationError });
        return;
      }

      res.json({
        terms: saveTranslationMemoryTermsChanges(translationMemoryId, req.body),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected server error.";
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
      const message = error instanceof Error ? error.message : "Unexpected server error.";
      res.status(500).json({ error: message });
    }
  });

  router.put("/api/translation-memories/:translationMemoryId", (req, res) => {
    try {
      const translationMemoryId = String(req.params.translationMemoryId);
      const existingTranslationMemory = getTranslationMemoryById(translationMemoryId);

      if (!existingTranslationMemory) {
        res.status(404).json({ error: "Translation memory not found." });
        return;
      }

      const validationError = validateTranslationMemoryInput(req.body);
      if (validationError) {
        res.status(400).json({ error: validationError });
        return;
      }

      const translationMemory = updateTranslationMemory(translationMemoryId, req.body);
      res.json(translationMemory);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected server error.";
      res.status(500).json({ error: message });
    }
  });

  router.put("/api/translation-memories/:translationMemoryId/terms/:termId", (req, res) => {
    try {
      const translationMemoryId = String(req.params.translationMemoryId);
      const termId = String(req.params.termId);
      const translationMemory = getTranslationMemoryById(translationMemoryId);

      if (!translationMemory) {
        res.status(404).json({ error: "Translation memory not found." });
        return;
      }

      const validationError = validateTranslationMemoryTermInput(req.body);
      if (validationError) {
        res.status(400).json({ error: validationError });
        return;
      }

      const term = updateTranslationMemoryTerm(translationMemoryId, termId, {
        sourceTerm: String(req.body.sourceTerm),
        targetTerm: String(req.body.targetTerm),
      });

      if (!term) {
        res.status(404).json({ error: "Translation memory term not found." });
        return;
      }

      res.json(term);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected server error.";
      res.status(500).json({ error: message });
    }
  });

  router.delete("/api/translation-memories/:translationMemoryId/terms/:termId", (req, res) => {
    try {
      const translationMemoryId = String(req.params.translationMemoryId);
      const termId = String(req.params.termId);
      const translationMemory = getTranslationMemoryById(translationMemoryId);

      if (!translationMemory) {
        res.status(404).json({ error: "Translation memory not found." });
        return;
      }

      deleteTranslationMemoryTerm(translationMemoryId, termId);
      res.status(204).send();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected server error.";
      res.status(500).json({ error: message });
    }
  });

  router.get("/api/glossaries", (_req, res) => {
    try {
      res.json({
        glossaries: listGlossaries(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected server error.";
      res.status(500).json({ error: message });
    }
  });

  router.get("/api/projects/:projectId/glossaries", (req, res) => {
    try {
      const projectId = String(req.params.projectId);
      const existingProject = getProjectById(projectId);

      if (!existingProject) {
        res.status(404).json({ error: "Project not found." });
        return;
      }

      res.json({
        glossaries: listProjectGlossaries(projectId),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected server error.";
      res.status(500).json({ error: message });
    }
  });

  router.get("/api/glossaries/:glossaryId", (req, res) => {
    try {
      const glossary = getGlossaryById(String(req.params.glossaryId));
      if (!glossary) {
        res.status(404).json({ error: "Glossary not found." });
        return;
      }

      res.json(glossary);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected server error.";
      res.status(500).json({ error: message });
    }
  });

  router.get("/api/glossaries/:glossaryId/items", (req, res) => {
    try {
      const glossaryId = String(req.params.glossaryId);
      const glossary = getGlossaryById(glossaryId);
      if (!glossary) {
        res.status(404).json({ error: "Glossary not found." });
        return;
      }

      res.json({
        items: listGlossaryItems(glossaryId),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected server error.";
      res.status(500).json({ error: message });
    }
  });

  router.put("/api/glossaries/:glossaryId/items", (req, res) => {
    try {
      const glossaryId = String(req.params.glossaryId);
      const glossary = getGlossaryById(glossaryId);
      if (!glossary) {
        res.status(404).json({ error: "Glossary not found." });
        return;
      }

      const validationError = validateGlossaryItemsChangesInput(req.body);
      if (validationError) {
        res.status(400).json({ error: validationError });
        return;
      }

      const items = saveGlossaryItemsChanges(glossaryId, req.body);
      res.json({ items });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected server error.";
      res.status(500).json({ error: message });
    }
  });

  router.post("/api/glossaries", (req, res) => {
    try {
      const validationError = validateGlossaryInput(req.body);
      if (validationError) {
        res.status(400).json({ error: validationError });
        return;
      }

      const glossary = createGlossary(req.body);
      res.status(201).json(glossary);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected server error.";
      res.status(500).json({ error: message });
    }
  });

  router.put("/api/glossaries/:glossaryId", (req, res) => {
    try {
      const glossaryId = String(req.params.glossaryId);
      const glossary = getGlossaryById(glossaryId);
      if (!glossary) {
        res.status(404).json({ error: "Glossary not found." });
        return;
      }

      const validationError = validateGlossaryInput(req.body);
      if (validationError) {
        res.status(400).json({ error: validationError });
        return;
      }

      res.json(updateGlossary(glossaryId, req.body));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected server error.";
      res.status(500).json({ error: message });
    }
  });

  router.post("/api/glossaries/:glossaryId/items", (req, res) => {
    try {
      const glossaryId = String(req.params.glossaryId);
      const glossary = getGlossaryById(glossaryId);
      if (!glossary) {
        res.status(404).json({ error: "Glossary not found." });
        return;
      }

      const validationError = validateGlossaryItemInput(req.body);
      if (validationError) {
        res.status(400).json({ error: validationError });
        return;
      }

      res.status(201).json(createGlossaryItem(glossaryId, req.body));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected server error.";
      res.status(500).json({ error: message });
    }
  });

  router.put("/api/glossaries/:glossaryId/items/:glossaryItemId", (req, res) => {
    try {
      const glossaryId = String(req.params.glossaryId);
      const glossaryItemId = String(req.params.glossaryItemId);
      const glossary = getGlossaryById(glossaryId);
      if (!glossary) {
        res.status(404).json({ error: "Glossary not found." });
        return;
      }

      const validationError = validateGlossaryItemInput(req.body);
      if (validationError) {
        res.status(400).json({ error: validationError });
        return;
      }

      const item = updateGlossaryItem(glossaryId, glossaryItemId, req.body);
      if (!item) {
        res.status(404).json({ error: "Glossary item not found." });
        return;
      }

      res.json(item);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected server error.";
      res.status(500).json({ error: message });
    }
  });

  router.delete("/api/glossaries/:glossaryId/items/:glossaryItemId", (req, res) => {
    try {
      const glossaryId = String(req.params.glossaryId);
      const glossary = getGlossaryById(glossaryId);
      if (!glossary) {
        res.status(404).json({ error: "Glossary not found." });
        return;
      }

      deleteGlossaryItem(glossaryId, String(req.params.glossaryItemId));
      res.status(204).send();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected server error.";
      res.status(500).json({ error: message });
    }
  });

  router.delete("/api/glossaries/:glossaryId", (req, res) => {
    try {
      const glossaryId = String(req.params.glossaryId);
      const glossary = getGlossaryById(glossaryId);
      if (!glossary) {
        res.status(404).json({ error: "Glossary not found." });
        return;
      }

      deleteGlossary(glossaryId);
      res.status(204).send();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected server error.";
      res.status(500).json({ error: message });
    }
  });

  router.delete("/api/translation-memories/:translationMemoryId", (req, res) => {
    try {
      const translationMemoryId = String(req.params.translationMemoryId);
      const existingTranslationMemory = getTranslationMemoryById(translationMemoryId);

      if (!existingTranslationMemory) {
        res.status(404).json({ error: "Translation memory not found." });
        return;
      }

      deleteTranslationMemory(translationMemoryId);
      res.status(204).send();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected server error.";
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

  router.post("/api/translate-providers/:providerName/prompt-preview", upload.single("file"), async (req, res) => {
    try {
      const providerName = String(req.params.providerName);
      const sourceLanguage = String(req.body.sourceLanguage ?? appConfig.defaultSourceLanguage);
      const targetLanguage = String(req.body.targetLanguage ?? appConfig.defaultTargetLanguage);
      const file = req.file;

      if (!file) {
        res.status(400).json({
          error: "A document file is required to preview buildPrompt.",
        });
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
      const message = error instanceof Error ? error.message : "Unexpected server error.";
      res.status(500).json({ error: message });
    }
  });

  router.post("/api/translate-document", upload.single("file"), async (req, res) => {
    const requestId = String(req.body.requestId ?? randomUUID());
    const sourceLanguage = String(req.body.sourceLanguage ?? appConfig.defaultSourceLanguage);
    const targetLanguage = String(req.body.targetLanguage ?? appConfig.defaultTargetLanguage);
    const providerName = String(req.body.providerName ?? appConfig.defaultTranslateProvider);
    const file = req.file;

    try {
      if (!file) {
        res.status(400).json({ error: "A document file is required." });
        return;
      }

       registerTranslationNotificationMetadata(requestId, {
        fileName: file.originalname,
        providerName,
      });
      setTranslationProgress(requestId, {
        phase: "queued",
        totalChunks: 0,
        completedChunks: 0,
        progressPercent: 0,
        message: "Preparing translation request.",
      });

      const result = await translateDocument({
        requestId,
        fileName: file.originalname,
        fileBuffer: file.buffer,
        sourceLanguage,
        targetLanguage,
        providerName,
        onProgress: (progress) => setTranslationProgress(requestId, progress),
      });

      const latestProgress = getTranslationProgress(requestId);
      setTranslationProgress(
        requestId,
        {
          phase: "completed",
          totalChunks: latestProgress?.totalChunks ?? 0,
          completedChunks:
            latestProgress?.totalChunks ?? latestProgress?.completedChunks ?? 0,
          progressPercent: 100,
          message: "Translation completed.",
        },
        {
          fileName: file.originalname,
          providerName: result.provider,
          downloadUrl: result.downloadUrl,
          durationMs: result.processingTimeMs,
          completedAt: new Date().toISOString(),
        },
      );

      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected server error.";
      const latestProgress = getTranslationProgress(requestId);
      setTranslationProgress(requestId, {
        phase: "failed",
        totalChunks: latestProgress?.totalChunks ?? 0,
        completedChunks: latestProgress?.completedChunks ?? 0,
        progressPercent: 100,
        message,
      }, {
        fileName: file?.originalname,
        providerName,
        completedAt: new Date().toISOString(),
      });
      res.status(500).json({ error: message });
    }
  });

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

function validateMergeProjectSegmentsInput(body: unknown) {
  if (!body || typeof body !== "object") {
    return "A merge segments payload is required.";
  }

  const { segmentIds } = body as Record<string, unknown>;
  if (!Array.isArray(segmentIds)) {
    return "segmentIds must be an array.";
  }

  if (segmentIds.length !== 2) {
    return "Exactly two segmentIds are required.";
  }

  for (const segmentId of segmentIds) {
    if (typeof segmentId !== "string" || segmentId.trim().length === 0) {
      return "Each segmentId must be a valid string.";
    }
  }

  if (new Set(segmentIds).size !== segmentIds.length) {
    return "segmentIds must be unique.";
  }

  return null;
}

function validateSplitProjectSegmentInput(body: unknown) {
  if (!body || typeof body !== "object") {
    return "A split segment payload is required.";
  }

  const { splitIndex } = body as Record<string, unknown>;
  if (typeof splitIndex !== "number" || !Number.isFinite(splitIndex)) {
    return "splitIndex must be a valid number.";
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

  if (typeof sourceLanguage !== "string" || sourceLanguage.trim().length === 0) {
    return "Source language is required.";
  }

  if (typeof targetLanguage !== "string" || targetLanguage.trim().length === 0) {
    return "Target language is required.";
  }

  return null;
}

function validateProjectTranslationMemoryInput(body: unknown) {
  if (!body || typeof body !== "object") {
    return "A project translation memory payload is required.";
  }

  const { translationMemoryId, accessMode, priority } = body as Record<string, unknown>;

  if (typeof translationMemoryId !== "string" || translationMemoryId.trim().length === 0) {
    return "Translation memory is required.";
  }

  if (accessMode !== "read" && accessMode !== "write") {
    return "Access mode must be read or write.";
  }

  if (typeof priority !== "number" && !(typeof priority === "string" && priority.trim().length > 0)) {
    return "Priority is required.";
  }

  const numericPriority = Number(priority);
  if (!Number.isInteger(numericPriority) || numericPriority < 0) {
    return "Priority must be a non-negative integer.";
  }

  return null;
}

function validateProjectGlossaryInput(body: unknown) {
  if (!body || typeof body !== "object") {
    return "A project glossary payload is required.";
  }

  const { glossaryId, priority } = body as Record<string, unknown>;

  if (typeof glossaryId !== "string" || glossaryId.trim().length === 0) {
    return "Glossary is required.";
  }

  if (typeof priority !== "number" && !(typeof priority === "string" && priority.trim().length > 0)) {
    return "Priority is required.";
  }

  const numericPriority = Number(priority);
  if (!Number.isInteger(numericPriority) || numericPriority < 0) {
    return "Priority must be a non-negative integer.";
  }

  return null;
}

function validateTranslationMemoryTermInput(body: unknown) {
  if (!body || typeof body !== "object") {
    return "A translation memory term payload is required.";
  }

  const { sourceTerm, targetTerm } = body as Record<string, unknown>;
  if (typeof sourceTerm !== "string" || sourceTerm.trim().length === 0) {
    return "Source term is required.";
  }

  if (typeof targetTerm !== "string" || targetTerm.trim().length === 0) {
    return "Target term is required.";
  }

  return null;
}

function validateTranslationMemoryTermsChangesInput(body: unknown) {
  if (!body || typeof body !== "object") {
    return "A translation memory terms changes payload is required.";
  }

  const { createdItems, updatedItems, deletedItemIds } = body as Record<string, unknown>;

  if (!Array.isArray(createdItems)) {
    return "createdItems must be an array.";
  }

  if (!Array.isArray(updatedItems)) {
    return "updatedItems must be an array.";
  }

  if (!Array.isArray(deletedItemIds)) {
    return "deletedItemIds must be an array.";
  }

  for (const item of createdItems) {
    const validationError = validateTranslationMemoryTermInput(item);
    if (validationError) {
      return validationError;
    }
  }

  for (const item of updatedItems) {
    if (!item || typeof item !== "object") {
      return "Each updated translation memory term must be an object.";
    }

    if (
      typeof (item as Record<string, unknown>).id !== "string" ||
      String((item as Record<string, unknown>).id).trim().length === 0
    ) {
      return "Each updated translation memory term must include a valid id.";
    }

    const validationError = validateTranslationMemoryTermInput(item);
    if (validationError) {
      return validationError;
    }
  }

  for (const termId of deletedItemIds) {
    if (typeof termId !== "string" || termId.trim().length === 0) {
      return "Each deletedItemId must be a valid string.";
    }
  }

  return null;
}

function validateGlossaryInput(body: unknown) {
  if (!body || typeof body !== "object") {
    return "A glossary payload is required.";
  }

  const { name, sourceLanguage, targetLanguage } = body as Record<string, unknown>;
  if (typeof name !== "string" || name.trim().length === 0) {
    return "Glossary name is required.";
  }

  if (typeof sourceLanguage !== "string" || sourceLanguage.trim().length === 0) {
    return "Source language is required.";
  }

  if (typeof targetLanguage !== "string" || targetLanguage.trim().length === 0) {
    return "Target language is required.";
  }

  return null;
}

function validateGlossaryItemInput(body: unknown) {
  if (!body || typeof body !== "object") {
    return "A glossary item payload is required.";
  }

  const { source, target, caseSensitive, wholeWord, priority } = body as Record<string, unknown>;

  if (typeof source !== "string" || source.trim().length === 0) {
    return "Glossary source is required.";
  }

  if (typeof target !== "string" || target.trim().length === 0) {
    return "Glossary target is required.";
  }

  if (caseSensitive !== undefined && typeof caseSensitive !== "boolean") {
    return "caseSensitive must be a boolean.";
  }

  if (wholeWord !== undefined && typeof wholeWord !== "boolean") {
    return "wholeWord must be a boolean.";
  }

  if (priority !== undefined && (typeof priority !== "number" || !Number.isFinite(priority))) {
    return "priority must be a valid number.";
  }

  return null;
}

function validateGlossaryItemsChangesInput(body: unknown) {
  if (!body || typeof body !== "object") {
    return "A glossary items changes payload is required.";
  }

  const { createdItems, updatedItems, deletedItemIds } = body as Record<string, unknown>;

  if (!Array.isArray(createdItems)) {
    return "createdItems must be an array.";
  }

  if (!Array.isArray(updatedItems)) {
    return "updatedItems must be an array.";
  }

  if (!Array.isArray(deletedItemIds)) {
    return "deletedItemIds must be an array.";
  }

  for (const item of createdItems) {
    const validationError = validateGlossaryItemInput(item);
    if (validationError) {
      return validationError;
    }
  }

  for (const item of updatedItems) {
    if (!item || typeof item !== "object") {
      return "Each updated glossary item must be an object.";
    }

    if (
      typeof (item as Record<string, unknown>).id !== "string" ||
      String((item as Record<string, unknown>).id).trim().length === 0
    ) {
      return "Each updated glossary item must include a valid id.";
    }

    const validationError = validateGlossaryItemInput(item);
    if (validationError) {
      return validationError;
    }
  }

  for (const glossaryItemId of deletedItemIds) {
    if (typeof glossaryItemId !== "string" || glossaryItemId.trim().length === 0) {
      return "Each deletedItemId must be a valid string.";
    }
  }

  return null;
}

function validateSettingsInput(body: unknown) {
  if (!body || typeof body !== "object") {
    return "A settings payload is required.";
  }

  const { inlineTranslateProvider } = body as Record<string, unknown>;
  const { termFuzzyMatchThreshold } = body as Record<string, unknown>;

  if (
    inlineTranslateProvider !== undefined &&
    inlineTranslateProvider !== null &&
    (typeof inlineTranslateProvider !== "string" || inlineTranslateProvider.trim().length === 0)
  ) {
    return "Inline translate provider must be null or a non-empty string.";
  }

  if (
    termFuzzyMatchThreshold !== undefined &&
    (typeof termFuzzyMatchThreshold !== "number" ||
      !Number.isFinite(termFuzzyMatchThreshold) ||
      termFuzzyMatchThreshold < 0 ||
      termFuzzyMatchThreshold > 1)
  ) {
    return "Term fuzzy match threshold must be a number between 0 and 1.";
  }

  return null;
}
