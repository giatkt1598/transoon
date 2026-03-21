import { createHash, randomUUID } from "crypto";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { appConfig } from "../config/app-config";
import { extractDocument } from "../document-service";
import { Log } from "../logger";
import { TranslateProvider } from "../translate-provider";
import { getTranslationMemoryDatabase } from "./database";
import type {
  DocumentEntity,
  ProjectEntity,
  ProjectStatus,
  SegmentEntity,
} from "./entities";
import { listProjectTranslationMemories } from "./translation-memory-service";
import { createTranslationMemoryRepositories } from "./repositories/repository-service";

export type ProjectSummary = ProjectEntity & {
  documentCount: number;
  segmentCount: number;
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
      p.createdAt,
      MIN(d.fileName) AS documentFileName,
      COUNT(DISTINCT d.id) AS documentCount,
      COUNT(DISTINCT s.id) AS segmentCount,
      COALESCE(SUM(CASE WHEN s.translationStatus IN ('translated', 'reviewed') THEN 1 ELSE 0 END), 0) AS translatedSegmentCount
    FROM projects p
    LEFT JOIN documents d ON d.projectId = p.id
    LEFT JOIN segments s ON s.documentId = d.id
    GROUP BY p.id, p.name, p.description, p.sourceLang, p.targetLang, p.status, p.createdAt
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
  const document = repositories.documents
    .query()
    .where("projectId", projectId)
    .orderBy("createdAt", "asc")
    .firstOrDefault();

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

export function createProject(input: UpsertProjectInput, options: CreateProjectOptions = {}) {
  const repositories = createTranslationMemoryRepositories();
  const project: ProjectEntity = {
    id: randomUUID(),
    name: input.name.trim(),
    description: input.description?.trim() ?? "",
    sourceLang: input.sourceLang,
    targetLang: input.targetLang,
    status: "idle",
    createdAt: new Date().toISOString(),
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
  repositories.projects.updateById(projectId, {
    name: input.name.trim(),
    description: input.description?.trim() ?? "",
    sourceLang: input.sourceLang,
    targetLang: input.targetLang,
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

  setProjectStatus(projectId, "auto-translate-processing");

  queueMicrotask(() => {
    void runProjectAutoTranslate(projectId, providerName);
  });

  return getProjectDetailById(projectId);
}

function mapProjectSummary(
  project: ProjectEntity & {
    documentFileName: string | null;
    documentCount: number;
    segmentCount: number;
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
    translatedSegmentCount: Number(project.translatedSegmentCount ?? 0),
    progressPercent,
    documentFileName: project.documentFileName,
  };
}

function setProjectStatus(projectId: string, status: ProjectStatus) {
  const repositories = createTranslationMemoryRepositories();
  repositories.projects.updateById(projectId, { status });
}

async function runProjectAutoTranslate(projectId: string, providerName: string) {
  const logger = Log.forContext({ projectId, providerName, job: "project-auto-translate" });

  try {
    const project = getProjectById(projectId);
    if (!project) {
      throw new Error("Project not found.");
    }

    const segments = listProjectSegments(projectId);
    if (segments.length === 0) {
      throw new Error("Project has no generated segments.");
    }

    await logger.information("Starting background auto translate for {projectId}", {
      segmentCount: segments.length,
      sourceLanguage: project.sourceLang,
      targetLanguage: project.targetLang,
    });

    const result = await TranslateProvider.resolve(providerName).translate({
      segments: segments.map((segment) => segment.sourceText),
      sourceLanguage: project.sourceLang,
      targetLanguage: project.targetLang,
    });

    if (result.translatedSegments.length !== segments.length) {
      throw new Error(
        `Auto translate returned ${result.translatedSegments.length} segments, expected ${segments.length}.`,
      );
    }

    const database = getTranslationMemoryDatabase();
    const repositories = createTranslationMemoryRepositories(database);
    const now = new Date().toISOString();

    database.exec("BEGIN");

    try {
      for (const [index, segment] of segments.entries()) {
        const targetText = result.translatedSegments[index] ?? "";
        repositories.segments.updateById(segment.id, {
          targetText,
          targetTextNormalized: normalizeText(targetText),
          targetTextHash: targetText ? hashText(targetText) : null,
          translationStatus: targetText.trim() ? "translated" : "pending",
          providerName,
          updatedAt: now,
        });
      }

      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }

    await logger.information("Completed background auto translate for {projectId}", {
      warnings: result.warnings,
      translatedCount: result.translatedSegments.length,
    });
  } catch (error) {
    await logger.error("Background auto translate failed for {projectId}", error);
  } finally {
    setProjectStatus(projectId, "idle");
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
