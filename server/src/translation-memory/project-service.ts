import { createHash, randomUUID } from "crypto";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { appConfig } from "../config/app-config";
import { languageCatalog } from "../config/language-catalog";
import { buildDocxPreviewDocument } from "../documents/docx-preview-service";
import { buildXlsxPreviewDocument } from "../documents/xlsx-preview-service";
import { extractDocument, writeOutputFile } from "../document-service";
import { Log } from "../logger";
import { setProjectAutoTranslateProgress } from "../project-auto-translate-progress";
import { TranslateProvider } from "../translate-provider";
import { getTranslationMemoryDatabase } from "./database";
import type {
  DocumentEntity,
  ProjectEntity,
  ProjectStatus,
  SegmentEntity,
} from "./entities";
import { getAppSettings } from "./settings-service";
import {
  listProjectTranslationMemories,
  upsertTranslationMemoryTerm,
  upsertTranslationMemoryUnit,
} from "./translation-memory-service";
import { createTranslationMemoryRepositories } from "./repositories/repository-service";

export type ProjectSummary = ProjectEntity & {
  documentCount: number;
  segmentCount: number;
  wordCount: number;
  characterCount: number;
  lastModifiedAt: string | null;
  translatedSegmentCount: number;
  progressPercent: number;
  documentFileName: string | null;
};

export type ProjectDetail = ProjectSummary & {
  translationMemories: ReturnType<typeof listProjectTranslationMemories>;
};

export type ProjectSegment = Pick<
  SegmentEntity,
  | "id"
  | "documentId"
  | "externalSegmentId"
  | "sourceText"
  | "targetText"
  | "position"
  | "translationStatus"
>;

export type SaveProjectSegmentInput = {
  id: string;
  targetText: string;
};

export type InlineTranslatedProjectSegment = {
  segmentId: string;
  targetText: string;
  providerName: string;
};

export type ConfirmProjectSegmentResult = {
  project: ProjectDetail | null;
  segment: ProjectSegment;
  insertedIntoWriteTranslationMemory: boolean;
  writeTranslationMemoryId: string | null;
  termConflict: boolean;
};

export type ExportProjectDocumentResult = {
  outputPath: string;
  outputFileName: string;
  downloadFileName: string;
  documentType: string | null;
};

export type ProjectDocumentPreviewResult =
  | Awaited<ReturnType<typeof buildDocxPreviewDocument>>
  | Awaited<ReturnType<typeof buildXlsxPreviewDocument>>
  | {
      documentType: string | null;
      fileName: string;
      supported: false;
      message: string;
    };

export type UpsertProjectInput = {
  name: string;
  description?: string;
  sourceLang: string;
  targetLang: string;
};

type CreateProjectOptions = {
  documentFile?: {
    originalName: string;
    buffer: Buffer;
  };
};

class AutoTranslateCancelledError extends Error {
  constructor() {
    super("Auto translate was cancelled.");
    this.name = "AutoTranslateCancelledError";
  }
}

const runningAutoTranslateJobs = new Map<
  string,
  { runId: string; controller: AbortController }
>();

export function listProjects() {
  const database = getTranslationMemoryDatabase();
  const sql = `
    SELECT
      p.id,
      p.name,
      p.description,
      p.sourceLang,
      p.targetLang,
      p.status,
      p.wordCount,
      p.characterCount,
      p.createdAt,
      p.lastModifiedAt,
      MIN(d.fileName) AS documentFileName,
      COUNT(DISTINCT d.id) AS documentCount,
      COUNT(DISTINCT s.id) AS segmentCount,
      COALESCE(SUM(CASE WHEN s.translationStatus IN ('translated', 'reviewed') THEN 1 ELSE 0 END), 0) AS translatedSegmentCount
    FROM projects p
    LEFT JOIN documents d ON d.projectId = p.id
    LEFT JOIN segments s ON s.documentId = d.id
    GROUP BY p.id, p.name, p.description, p.sourceLang, p.targetLang, p.status, p.createdAt, p.lastModifiedAt
    ORDER BY p.createdAt DESC
  `;

  const rows = database.prepare(sql).all() as Array<
    ProjectEntity & {
      documentCount: number;
      segmentCount: number;
      translatedSegmentCount: number;
      documentFileName: string | null;
    }
  >;
  return rows.map(mapProjectSummary);
}

export function getProjectById(projectId: string) {
  return listProjects().find((project) => project.id === projectId) ?? null;
}

export function isProjectProcessing(projectId: string) {
  return getProjectById(projectId)?.status === "auto-translate-processing";
}

export function getProjectDetailById(projectId: string) {
  const project = getProjectById(projectId);
  if (!project) {
    return null;
  }

  return {
    ...project,
    translationMemories: listProjectTranslationMemories(projectId),
  } satisfies ProjectDetail;
}

export function listProjectSegments(projectId: string) {
  const database = getTranslationMemoryDatabase();
  const sql = `
    SELECT
      s.id,
      s.documentId,
      s.externalSegmentId,
      s.sourceText,
      s.targetText,
      s.position,
      s.translationStatus
    FROM segments s
    INNER JOIN documents d ON d.id = s.documentId
    WHERE d.projectId = ?
    ORDER BY s.position ASC
  `;

  return database.prepare(sql).all(projectId) as ProjectSegment[];
}

export async function generateProjectSegments(projectId: string) {
  assertProjectIsEditable(projectId);
  const repositories = createTranslationMemoryRepositories();
  const document = getPrimaryProjectDocument(projectId);

  if (!document) {
    throw new Error("No document is attached to this project.");
  }

  if (!document.storagePath) {
    throw new Error("The project document is missing its storage path.");
  }

  const absoluteStoragePath = path.resolve(process.cwd(), document.storagePath);
  const fileBuffer = readFileSync(absoluteStoragePath);
  const extractedDocument = await extractDocument(document.fileName, fileBuffer);
  const database = getTranslationMemoryDatabase();
  const now = new Date().toISOString();

  database.exec("BEGIN");

  try {
    database.prepare(`DELETE FROM "segment_tokens" WHERE "segmentId" IN (
      SELECT "id" FROM "segments" WHERE "documentId" = ?
    )`).run(document.id);
    database.prepare(`DELETE FROM "segments" WHERE "documentId" = ?`).run(document.id);

    for (const [index, segment] of extractedDocument.segments.entries()) {
      const sourceText = segment.text.trim();
      if (!sourceText) {
        continue;
      }

      const segmentId = randomUUID();
      const sourceTextNormalized = normalizeText(sourceText);
      repositories.segments.insert({
        id: segmentId,
        documentId: document.id,
        externalSegmentId: segment.id,
        sourceLanguage: getProjectById(projectId)?.sourceLang ?? appConfig.defaultSourceLanguage,
        targetLanguage: getProjectById(projectId)?.targetLang ?? appConfig.defaultTargetLanguage,
        sourceText,
        sourceTextNormalized,
        sourceTextHash: hashText(sourceText),
        targetText: "",
        targetTextNormalized: "",
        targetTextHash: null,
        tokensJson: JSON.stringify([{ type: "text", value: sourceText }]),
        position: index + 1,
        translationStatus: "pending",
        providerName: null,
        reviewedByHuman: 0,
        createdAt: now,
        updatedAt: now,
      });

      repositories.segmentTokens.insert({
        segmentId,
        tokenIndex: 0,
        tokenType: "text",
        tokenValue: sourceText,
      });
    }

    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }

  return {
    project: getProjectDetailById(projectId),
    segments: listProjectSegments(projectId),
  };
}

export async function exportProjectDocument(
  projectId: string,
): Promise<ExportProjectDocumentResult> {
  const project = getProjectById(projectId);
  const document = getPrimaryProjectDocument(projectId);

  if (!project) {
    throw new Error("Project not found.");
  }

  if (!document) {
    throw new Error("No document is attached to this project.");
  }

  if (!document.storagePath) {
    throw new Error("The project document is missing its storage path.");
  }

  const absoluteStoragePath = path.resolve(process.cwd(), document.storagePath);
  const fileBuffer = readFileSync(absoluteStoragePath);
  const extractedDocument = await extractDocument(document.fileName, fileBuffer);
  const savedSegmentMap = new Map(
    listProjectSegments(projectId).map((segment) => [
      segment.externalSegmentId,
      segment.targetText.trim().length > 0 ? segment.targetText : segment.sourceText,
    ] as const),
  );
  const nextSegments = extractedDocument.segments.map(
    (segment) => savedSegmentMap.get(segment.id) ?? segment.text,
  );
  const outputBuffer = await extractedDocument.replaceSegments(nextSegments);
  const { outputPath, outputFileName } = await writeOutputFile(
    document.fileName,
    outputBuffer,
  );
  const downloadFileName = buildExportDownloadFileName(
    document.fileName,
    project.targetLang,
  );

  return {
    outputPath,
    outputFileName,
    downloadFileName,
    documentType: document.documentType,
  };
}

export async function getProjectDocumentPreview(
  projectId: string,
): Promise<ProjectDocumentPreviewResult> {
  const project = getProjectById(projectId);
  const document = getPrimaryProjectDocument(projectId);

  if (!project) {
    throw new Error("Project not found.");
  }

  if (!document) {
    throw new Error("No document is attached to this project.");
  }

  if (!document.storagePath) {
    throw new Error("The project document is missing its storage path.");
  }

  if (document.documentType !== "docx" && document.documentType !== "xlsx") {
    return {
      documentType: document.documentType,
      fileName: document.fileName,
      supported: false,
      message:
        "Document preview is currently implemented for .docx and .xlsx files only.",
    };
  }

  const absoluteStoragePath = path.resolve(process.cwd(), document.storagePath);
  const fileBuffer = readFileSync(absoluteStoragePath);

  if (document.documentType === "xlsx") {
    return buildXlsxPreviewDocument(document.fileName, fileBuffer);
  }

  return buildDocxPreviewDocument(document.fileName, fileBuffer);
}

export function saveProjectSegments(
  projectId: string,
  inputSegments: SaveProjectSegmentInput[],
) {
  assertProjectIsEditable(projectId);

  if (inputSegments.length === 0) {
    return {
      project: getProjectDetailById(projectId),
      segments: listProjectSegments(projectId),
    };
  }

  const existingSegments = listProjectSegments(projectId);
  const existingSegmentMap = new Map(
    existingSegments.map((segment) => [segment.id, segment] as const),
  );
  const database = getTranslationMemoryDatabase();
  const repositories = createTranslationMemoryRepositories(database);
  const now = new Date().toISOString();

  database.exec("BEGIN");

  try {
    for (const inputSegment of inputSegments) {
      const segment = existingSegmentMap.get(inputSegment.id);
      if (!segment) {
        throw new Error(`Segment ${inputSegment.id} was not found in this project.`);
      }

      const targetText = inputSegment.targetText ?? "";
      const trimmedTargetText = targetText.trim();
      repositories.segments.updateById(segment.id, {
        targetText,
        targetTextNormalized: trimmedTargetText
          ? normalizeText(targetText)
          : "",
        targetTextHash: trimmedTargetText ? hashText(targetText) : null,
        translationStatus: trimmedTargetText ? "reviewed" : "pending",
        providerName: null,
        reviewedByHuman: trimmedTargetText ? 1 : 0,
        updatedAt: now,
      });
    }

    touchProject(projectId, now);

    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }

  return {
    project: getProjectDetailById(projectId),
    segments: listProjectSegments(projectId),
  };
}

export function confirmProjectSegment(
  projectId: string,
  segmentId: string,
  targetTextInput?: string,
): ConfirmProjectSegmentResult {
  assertProjectIsEditable(projectId);

  const project = getProjectById(projectId);
  if (!project) {
    throw new Error("Project not found.");
  }

  const segment = listProjectSegments(projectId).find(
    (projectSegment) => projectSegment.id === segmentId,
  );
  if (!segment) {
    throw new Error("Segment not found in this project.");
  }

  const targetText = (targetTextInput ?? segment.targetText ?? "").trim();

  const database = getTranslationMemoryDatabase();
  const repositories = createTranslationMemoryRepositories(database);
  const now = new Date().toISOString();
  const writeTranslationMemory = listProjectTranslationMemories(projectId).find(
    (item) => item.accessMode === "write",
  );
  let termConflict = false;
  let insertedIntoWriteTranslationMemory = false;

  database.exec("BEGIN");

  try {
    repositories.segments.updateById(segment.id, {
      targetText,
      targetTextNormalized: normalizeText(targetText),
      targetTextHash: hashText(targetText),
      translationStatus: "reviewed",
      providerName: null,
      reviewedByHuman: 1,
      updatedAt: now,
    });

    if (writeTranslationMemory && targetText) {
      upsertTranslationMemoryUnit({
        translationMemoryId: writeTranslationMemory.translationMemoryId,
        projectId,
        sourceLanguage: project.sourceLang,
        targetLanguage: project.targetLang,
        sourceText: segment.sourceText,
        targetText,
        originDocumentId: segment.documentId,
        originSegmentId: segment.id,
        providerName: null,
      });
      insertedIntoWriteTranslationMemory = true;

      const termResult = upsertTranslationMemoryTerm({
        translationMemoryId: writeTranslationMemory.translationMemoryId,
        sourceTerm: segment.sourceText,
        targetTerm: targetText,
      });
      termConflict = termResult.conflict;
    }

    touchProject(projectId, now);

    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }

  const updatedSegment = listProjectSegments(projectId).find(
    (projectSegment) => projectSegment.id === segmentId,
  );
  if (!updatedSegment) {
    throw new Error("Confirmed segment could not be reloaded.");
  }

  return {
    project: getProjectDetailById(projectId),
    segment: updatedSegment,
    insertedIntoWriteTranslationMemory,
    writeTranslationMemoryId:
      writeTranslationMemory?.translationMemoryId ?? null,
    termConflict,
  };
}

export async function inlineTranslateProjectSegment(
  projectId: string,
  segmentId: string,
) {
  assertProjectIsEditable(projectId);

  const project = getProjectById(projectId);
  if (!project) {
    throw new Error("Project not found.");
  }

  const segment = listProjectSegments(projectId).find(
    (projectSegment) => projectSegment.id === segmentId,
  );
  if (!segment) {
    throw new Error("Segment not found in this project.");
  }

  if (!segment.sourceText.trim()) {
    throw new Error("The current segment does not contain any source text.");
  }

  const { inlineTranslateProvider } = getAppSettings();
  const provider = TranslateProvider.resolve(inlineTranslateProvider);
  const result = await provider.translate({
    segments: [segment.sourceText],
    sourceLanguage: project.sourceLang,
    targetLanguage: project.targetLang,
    promptMode: "inline",
  });

  const targetText = result.translatedSegments[0]?.trim()
    ? result.translatedSegments[0]
    : "";

  if (!targetText) {
    throw new Error("Inline translate did not return any translated text.");
  }

  return {
    segmentId,
    targetText,
    providerName: result.provider,
  } satisfies InlineTranslatedProjectSegment;
}

export async function createProject(input: UpsertProjectInput, options: CreateProjectOptions = {}) {
  const repositories = createTranslationMemoryRepositories();
  const now = new Date().toISOString();
  const contentCounts = options.documentFile
    ? await buildProjectContentCounts(
        options.documentFile.originalName,
        options.documentFile.buffer,
      )
    : { wordCount: 0, characterCount: 0 };
  const project: ProjectEntity = {
    id: randomUUID(),
    name: input.name.trim(),
    description: input.description?.trim() ?? "",
    sourceLang: input.sourceLang,
    targetLang: input.targetLang,
    status: "idle",
    wordCount: contentCounts.wordCount,
    characterCount: contentCounts.characterCount,
    createdAt: now,
    lastModifiedAt: null,
  };

  repositories.projects.insert(project);
  if (options.documentFile) {
    const document = storeProjectDocument(project.id, options.documentFile);
    repositories.documents.insert(document);
  }

  return getProjectById(project.id);
}

export function updateProject(projectId: string, input: UpsertProjectInput) {
  assertProjectIsEditable(projectId);
  const repositories = createTranslationMemoryRepositories();
  const now = new Date().toISOString();
  repositories.projects.updateById(projectId, {
    name: input.name.trim(),
    description: input.description?.trim() ?? "",
    sourceLang: input.sourceLang,
    targetLang: input.targetLang,
    lastModifiedAt: now,
  });

  return getProjectById(projectId);
}

export function deleteProject(projectId: string) {
  assertProjectIsEditable(projectId);
  const repositories = createTranslationMemoryRepositories();
  repositories.projects.deleteById(projectId);
}

export async function startProjectAutoTranslate(
  projectId: string,
  providerName: string,
) {
  assertProjectIsEditable(projectId);

  const project = getProjectById(projectId);
  if (!project) {
    throw new Error("Project not found.");
  }

  const segments = listProjectSegments(projectId);
  if (segments.length === 0) {
    throw new Error("Generate segments before running auto translate.");
  }
  const translatedSegmentCount = segments.filter(isSegmentAlreadyTranslated).length;

  setProjectStatus(projectId, "auto-translate-processing");
  setProjectAutoTranslateProgress(projectId, {
    phase: "queued",
    completedSegments: translatedSegmentCount,
    totalSegments: segments.length,
    progressPercent:
      segments.length === 0
        ? 0
        : Math.round((translatedSegmentCount / segments.length) * 100),
    message: "Preparing background auto translate.",
  });

  const runId = randomUUID();
  const controller = new AbortController();
  runningAutoTranslateJobs.set(projectId, { runId, controller });

  queueMicrotask(() => {
    void runProjectAutoTranslate(projectId, providerName, runId, controller);
  });

  return getProjectDetailById(projectId);
}

export function cancelProjectAutoTranslate(projectId: string) {
  const project = getProjectById(projectId);
  if (!project) {
    throw new Error("Project not found.");
  }

  const runningJob = runningAutoTranslateJobs.get(projectId);
  if (runningJob) {
    runningJob.controller.abort();
    runningAutoTranslateJobs.delete(projectId);
  }

  setProjectStatus(projectId, "idle");
  touchProject(projectId);

  const latestProject = getProjectById(projectId);
  setProjectAutoTranslateProgress(projectId, {
    phase: "cancelled",
    completedSegments: latestProject?.translatedSegmentCount ?? 0,
    totalSegments: latestProject?.segmentCount ?? 0,
    progressPercent: latestProject?.progressPercent ?? 0,
    message: "Auto translate was cancelled.",
  });

  return getProjectDetailById(projectId);
}

function mapProjectSummary(
  project: ProjectEntity & {
    documentFileName: string | null;
    documentCount: number;
    segmentCount: number;
    wordCount?: number;
    characterCount?: number;
    lastModifiedAt?: string | null;
    translatedSegmentCount: number;
  },
): ProjectSummary {
  const progressPercent =
    project.segmentCount > 0
      ? Math.round((project.translatedSegmentCount / project.segmentCount) * 100)
      : 0;

  return {
    ...project,
    documentCount: Number(project.documentCount ?? 0),
    segmentCount: Number(project.segmentCount ?? 0),
    wordCount: Number(project.wordCount ?? 0),
    characterCount: Number(project.characterCount ?? 0),
    lastModifiedAt: project.lastModifiedAt ?? null,
    translatedSegmentCount: Number(project.translatedSegmentCount ?? 0),
    progressPercent,
    documentFileName: project.documentFileName,
  };
}

function setProjectStatus(projectId: string, status: ProjectStatus) {
  const repositories = createTranslationMemoryRepositories();
  repositories.projects.updateById(projectId, { status });
}

function getPrimaryProjectDocument(projectId: string) {
  const repositories = createTranslationMemoryRepositories();
  return repositories.documents
    .query()
    .where("projectId", projectId)
    .orderBy("createdAt", "asc")
    .firstOrDefault();
}

async function runProjectAutoTranslate(
  projectId: string,
  providerName: string,
  runId: string,
  controller: AbortController,
) {
  const logger = Log.forContext({ projectId, providerName, job: "project-auto-translate" });
  let totalSegments = 0;
  let translatedSegmentCount = 0;
  const ensureJobIsActive = () => {
    const runningJob = runningAutoTranslateJobs.get(projectId);
    if (
      controller.signal.aborted ||
      !runningJob ||
      runningJob.runId !== runId
    ) {
      throw new AutoTranslateCancelledError();
    }
  };

  try {
    ensureJobIsActive();
    const project = getProjectById(projectId);
    if (!project) {
      throw new Error("Project not found.");
    }

    const allSegments = listProjectSegments(projectId);
    totalSegments = allSegments.length;
    if (allSegments.length === 0) {
      throw new Error("Project has no generated segments.");
    }
    translatedSegmentCount = allSegments.filter(isSegmentAlreadyTranslated).length;
    const initialTranslatedSegmentCount = translatedSegmentCount;
    const segments = allSegments.filter(
      (segment) => !isSegmentAlreadyTranslated(segment),
    );

    if (segments.length === 0) {
      await logger.information("Skipped background auto translate because all segments were already translated.", {
        totalSegments,
      });
      setProjectStatus(projectId, "idle");
      touchProject(projectId);
      setProjectAutoTranslateProgress(projectId, {
        phase: "completed",
        completedSegments: translatedSegmentCount,
        totalSegments,
        progressPercent:
          totalSegments === 0
            ? 100
            : Math.round((translatedSegmentCount / totalSegments) * 100),
        message: "All segments are already translated.",
      });
      return;
    }

    await logger.information("Starting background auto translate for {projectId}", {
      segmentCount: totalSegments,
      pendingSegmentCount: segments.length,
      translatedSegmentCount,
      sourceLanguage: project.sourceLang,
      targetLanguage: project.targetLang,
    });

    const result = await TranslateProvider.resolve(providerName).translate({
      segments: segments.map((segment) => segment.sourceText),
      sourceLanguage: project.sourceLang,
      targetLanguage: project.targetLang,
      signal: controller.signal,
      onProgress: (progress) => {
        ensureJobIsActive();
        const currentTranslatedSegmentCount = Math.min(
          totalSegments,
          Math.max(
            translatedSegmentCount,
            initialTranslatedSegmentCount + progress.completedChunks,
          ),
        );
        setProjectAutoTranslateProgress(projectId, {
          phase: "translating",
          completedSegments: currentTranslatedSegmentCount,
          totalSegments,
          progressPercent:
            totalSegments === 0
              ? 100
              : Math.round((currentTranslatedSegmentCount / totalSegments) * 100),
          message: `Auto translated ${currentTranslatedSegmentCount} of ${totalSegments} segments.`,
        });
      },
      onTranslatedSegments: async (batch) => {
        ensureJobIsActive();
        translatedSegmentCount = persistAutoTranslatedSegments(
          segments,
          batch,
          providerName,
          translatedSegmentCount,
        );
        setProjectAutoTranslateProgress(projectId, {
          phase: "translating",
          completedSegments: translatedSegmentCount,
          totalSegments,
          progressPercent:
            totalSegments === 0
              ? 100
              : Math.round((translatedSegmentCount / totalSegments) * 100),
          message: `Auto translated ${translatedSegmentCount} of ${totalSegments} segments.`,
        });
      },
    });

    ensureJobIsActive();

    if (result.translatedSegments.length !== segments.length) {
      throw new Error(
        `Auto translate returned ${result.translatedSegments.length} segments, expected ${segments.length}.`,
      );
    }

    await logger.information("Completed background auto translate for {projectId}", {
      warnings: result.warnings,
      translatedCount: translatedSegmentCount,
    });
    setProjectStatus(projectId, "idle");
    touchProject(projectId);
    setProjectAutoTranslateProgress(projectId, {
      phase: "completed",
      completedSegments: translatedSegmentCount,
      totalSegments,
      progressPercent:
        totalSegments === 0
          ? 100
          : Math.round((translatedSegmentCount / totalSegments) * 100),
      message:
        translatedSegmentCount >= totalSegments
          ? "Auto translate completed."
          : `Auto translate completed with partial results. ${translatedSegmentCount} of ${totalSegments} segments are now translated.`,
    });
  } catch (error) {
    if (error instanceof AutoTranslateCancelledError) {
      await logger.information("Background auto translate was cancelled for {projectId}");
      return;
    }

    await logger.error("Background auto translate failed for {projectId}", error);
    setProjectStatus(projectId, "idle");
    touchProject(projectId);
    setProjectAutoTranslateProgress(projectId, {
      phase: "failed",
      completedSegments: translatedSegmentCount,
      totalSegments,
      progressPercent:
        totalSegments === 0
          ? 0
          : Math.round((translatedSegmentCount / totalSegments) * 100),
      message:
        error instanceof Error
          ? error.message
          : "Auto translate failed unexpectedly.",
    });
  } finally {
    const runningJob = runningAutoTranslateJobs.get(projectId);
    if (runningJob?.runId === runId) {
      runningAutoTranslateJobs.delete(projectId);
    }
  }
}

export function assertProjectIsEditable(projectId: string) {
  if (isProjectProcessing(projectId)) {
    throw new Error(
      "This project is currently running auto translate. Manual changes are disabled until the background job finishes.",
    );
  }
}

function storeProjectDocument(
  projectId: string,
  file: {
    originalName: string;
    buffer: Buffer;
  },
): DocumentEntity {
  const documentId = randomUUID();
  const fileExtension = path.extname(file.originalName).toLowerCase();
  const safeExtension = /^[.][a-z0-9]+$/.test(fileExtension) ? fileExtension : "";
  const relativeStoragePath = path.join(
    appConfig.projectDocumentsStoragePath,
    projectId,
    `${documentId}${safeExtension}`,
  );
  const absoluteStoragePath = path.resolve(process.cwd(), relativeStoragePath);

  mkdirSync(path.dirname(absoluteStoragePath), { recursive: true });
  writeFileSync(absoluteStoragePath, file.buffer);

  return {
    id: documentId,
    projectId,
    fileName: file.originalName,
    documentType: safeExtension ? safeExtension.slice(1) : null,
    contentSha256: createHash("sha256").update(file.buffer).digest("hex"),
    storagePath: relativeStoragePath.replace(/\\/g, "/"),
    createdAt: new Date().toISOString(),
  };
}

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}


function hashText(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function countWords(value: string) {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return 0;
  }

  return trimmedValue.split(/\s+/u).length;
}

function countCharacters(value: string) {
  return Array.from(value).length;
}

async function buildProjectContentCounts(fileName: string, buffer: Buffer) {
  const extractedDocument = await extractDocument(fileName, buffer);
  const nonEmptySegments = extractedDocument.segments
    .map((segment) => segment.text.trim())
    .filter((segment) => segment.length > 0);

  return {
    wordCount: nonEmptySegments.reduce(
      (total, segment) => total + countWords(segment),
      0,
    ),
    characterCount: nonEmptySegments.reduce(
      (total, segment) => total + countCharacters(segment),
      0,
    ),
  };
}

function touchProject(projectId: string, value = new Date().toISOString()) {
  const repositories = createTranslationMemoryRepositories();
  repositories.projects.updateById(projectId, { lastModifiedAt: value });
}

function buildExportDownloadFileName(
  sourceFileName: string,
  targetLanguage: string,
) {
  const extension = path.extname(sourceFileName);
  const baseName = path.basename(sourceFileName, extension);
  const targetLanguageLabel = getLanguageLabel(targetLanguage);

  return `${baseName} (${targetLanguageLabel})${extension}`;
}

function getLanguageLabel(languageCode: string) {
  return (
    languageCatalog.languages.find((language) => language.code === languageCode)
      ?.label ?? languageCode
  );
}

function isSegmentAlreadyTranslated(
  segment: Pick<ProjectSegment, "targetText" | "translationStatus">,
) {
  return (
    ["translated", "reviewed"].includes(segment.translationStatus) ||
    segment.targetText.trim().length > 0
  );
}

function persistAutoTranslatedSegments(
  segments: ProjectSegment[],
  translatedSegments: Array<{ index: number; text: string }>,
  providerName: string,
  currentTranslatedSegmentCount: number,
) {
  if (translatedSegments.length === 0) {
    return currentTranslatedSegmentCount;
  }

  const segmentByIndex = new Map(
    segments.map((segment, index) => [index, segment] as const),
  );
  const database = getTranslationMemoryDatabase();
  const repositories = createTranslationMemoryRepositories(database);
  const now = new Date().toISOString();
  let nextTranslatedSegmentCount = currentTranslatedSegmentCount;

  database.exec("BEGIN");

  try {
    for (const translatedSegment of translatedSegments) {
      const segment = segmentByIndex.get(translatedSegment.index);
      const targetText = translatedSegment.text ?? "";

      if (!segment || !targetText.trim()) {
        continue;
      }

      const wasAlreadyTranslated = isSegmentAlreadyTranslated(segment);

      repositories.segments.updateById(segment.id, {
        targetText,
        targetTextNormalized: normalizeText(targetText),
        targetTextHash: hashText(targetText),
        translationStatus: "translated",
        providerName,
        updatedAt: now,
      });

      segment.targetText = targetText;
      segment.translationStatus = "translated";

      if (!wasAlreadyTranslated) {
        nextTranslatedSegmentCount += 1;
      }
    }

    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }

  return nextTranslatedSegmentCount;
}
