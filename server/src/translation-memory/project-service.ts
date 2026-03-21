import { randomUUID } from "crypto";
import { getTranslationMemoryDatabase } from "./database";
import type { ProjectEntity } from "./entities";
import { createTranslationMemoryRepositories } from "./repositories/repository-service";

export type ProjectSummary = ProjectEntity & {
  documentCount: number;
  segmentCount: number;
  translatedSegmentCount: number;
  progressPercent: number;
};

export type UpsertProjectInput = {
  name: string;
  sourceLang: string;
  targetLang: string;
};

export function listProjects() {
  const database = getTranslationMemoryDatabase();
  const sql = `
    SELECT
      p.id,
      p.name,
      p.sourceLang,
      p.targetLang,
      p.createdAt,
      COUNT(DISTINCT d.id) AS documentCount,
      COUNT(DISTINCT s.id) AS segmentCount,
      COALESCE(SUM(CASE WHEN s.translationStatus IN ('translated', 'reviewed') THEN 1 ELSE 0 END), 0) AS translatedSegmentCount
    FROM projects p
    LEFT JOIN documents d ON d.projectId = p.id
    LEFT JOIN segments s ON s.documentId = d.id
    GROUP BY p.id, p.name, p.sourceLang, p.targetLang, p.createdAt
    ORDER BY p.createdAt DESC
  `;

  const rows = database.prepare(sql).all() as Array<
    ProjectEntity & {
      documentCount: number;
      segmentCount: number;
      translatedSegmentCount: number;
    }
  >;

  return rows.map(mapProjectSummary);
}

export function getProjectById(projectId: string) {
  return listProjects().find((project) => project.id === projectId) ?? null;
}

export function createProject(input: UpsertProjectInput) {
  const repositories = createTranslationMemoryRepositories();
  const project: ProjectEntity = {
    id: randomUUID(),
    name: input.name.trim(),
    sourceLang: input.sourceLang,
    targetLang: input.targetLang,
    createdAt: new Date().toISOString(),
  };

  repositories.projects.insert(project);

  return getProjectById(project.id);
}

export function updateProject(projectId: string, input: UpsertProjectInput) {
  const repositories = createTranslationMemoryRepositories();
  repositories.projects.updateById(projectId, {
    name: input.name.trim(),
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
  };
}
