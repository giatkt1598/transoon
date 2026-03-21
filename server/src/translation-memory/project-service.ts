import { createHash, randomUUID } from "crypto";
import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { appConfig } from "../config/app-config";
import { getTranslationMemoryDatabase } from "./database";
import type { DocumentEntity, ProjectEntity } from "./entities";
import { createTranslationMemoryRepositories } from "./repositories/repository-service";

export type ProjectSummary = ProjectEntity & {
  documentCount: number;
  segmentCount: number;
  translatedSegmentCount: number;
  progressPercent: number;
  documentFileName: string | null;
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

export function listProjects() {
  const database = getTranslationMemoryDatabase();
  const sql = `
    SELECT
      p.id,
      p.name,
      p.description,
      p.sourceLang,
      p.targetLang,
      p.createdAt,
      MIN(d.fileName) AS documentFileName,
      COUNT(DISTINCT d.id) AS documentCount,
      COUNT(DISTINCT s.id) AS segmentCount,
      COALESCE(SUM(CASE WHEN s.translationStatus IN ('translated', 'reviewed') THEN 1 ELSE 0 END), 0) AS translatedSegmentCount
    FROM projects p
    LEFT JOIN documents d ON d.projectId = p.id
    LEFT JOIN segments s ON s.documentId = d.id
    GROUP BY p.id, p.name, p.description, p.sourceLang, p.targetLang, p.createdAt
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

export function createProject(input: UpsertProjectInput, options: CreateProjectOptions = {}) {
  const repositories = createTranslationMemoryRepositories();
  const project: ProjectEntity = {
    id: randomUUID(),
    name: input.name.trim(),
    description: input.description?.trim() ?? "",
    sourceLang: input.sourceLang,
    targetLang: input.targetLang,
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
  const repositories = createTranslationMemoryRepositories();
  repositories.projects.deleteById(projectId);
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
