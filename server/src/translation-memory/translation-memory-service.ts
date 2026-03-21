import { randomUUID } from "crypto";
import type {
  ProjectTranslationMemoryEntity,
  TermEntity,
  TranslationMemoryAccessMode,
  TranslationMemoryEntity,
} from "./entities";
import { getTranslationMemoryDatabase } from "./database";
import { createTranslationMemoryRepositories } from "./repositories/repository-service";

export type TranslationMemorySummary = TranslationMemoryEntity & {
  termCount: number;
};

export type CreateTranslationMemoryInput = {
  name: string;
  sourceLanguage: string;
  targetLanguage: string;
};

export type CreateTermInput = {
  translationMemoryId: string;
  sourceTerm: string;
  targetTerm: string;
};

export type AttachTranslationMemoryToProjectInput = {
  projectId: string;
  translationMemoryId: string;
  accessMode: TranslationMemoryAccessMode;
  priority: number;
};

export type ProjectTranslationMemorySummary = ProjectTranslationMemoryEntity &
  TranslationMemorySummary & {
    linkedAt: string;
  };

export function listTranslationMemories() {
  const database = getTranslationMemoryDatabase();
  const sql = `
    SELECT
      tm.id,
      tm.name,
      tm.sourceLanguage,
      tm.targetLanguage,
      tm.lastModifiedAt,
      tm.lastUsedAt,
      tm.createdAt,
      COUNT(t.id) AS termCount
    FROM translationMemories tm
    LEFT JOIN terms t ON t.translationMemoryId = tm.id
    GROUP BY
      tm.id,
      tm.name,
      tm.sourceLanguage,
      tm.targetLanguage,
      tm.lastModifiedAt,
      tm.lastUsedAt,
      tm.createdAt
    ORDER BY tm.lastModifiedAt DESC
  `;

  const rows = database.prepare(sql).all() as Array<
    TranslationMemoryEntity & {
      termCount: number;
    }
  >;

  return rows.map(mapTranslationMemorySummary);
}

export function getTranslationMemoryById(translationMemoryId: string) {
  return (
    listTranslationMemories().find(
      (translationMemory) => translationMemory.id === translationMemoryId,
    ) ?? null
  );
}

export function createTranslationMemory(input: CreateTranslationMemoryInput) {
  const repositories = createTranslationMemoryRepositories();
  const now = new Date().toISOString();
  const entity: TranslationMemoryEntity = {
    id: randomUUID(),
    name: input.name.trim(),
    sourceLanguage: input.sourceLanguage,
    targetLanguage: input.targetLanguage,
    lastModifiedAt: now,
    lastUsedAt: null,
    createdAt: now,
  };

  repositories.translationMemories.insert(entity);
  return getTranslationMemoryById(entity.id);
}

export function updateTranslationMemory(
  translationMemoryId: string,
  input: CreateTranslationMemoryInput,
) {
  const now = new Date().toISOString();

  createTranslationMemoryRepositories().translationMemories.updateById(
    translationMemoryId,
    {
      name: input.name.trim(),
      sourceLanguage: input.sourceLanguage,
      targetLanguage: input.targetLanguage,
      lastModifiedAt: now,
    },
  );

  return getTranslationMemoryById(translationMemoryId);
}

export function deleteTranslationMemory(translationMemoryId: string) {
  createTranslationMemoryRepositories().translationMemories.deleteById(
    translationMemoryId,
  );
}

export function createTerm(input: CreateTermInput) {
  const repositories = createTranslationMemoryRepositories();
  const now = new Date().toISOString();
  const entity: TermEntity = {
    id: randomUUID(),
    translationMemoryId: input.translationMemoryId,
    sourceTerm: input.sourceTerm,
    sourceTermNormalized: normalizeTerm(input.sourceTerm),
    targetTerm: input.targetTerm,
    targetTermNormalized: normalizeTerm(input.targetTerm),
    lastModifiedAt: now,
    lastUsedAt: null,
    createdAt: now,
  };

  repositories.terms.insert(entity);
  touchTranslationMemory(input.translationMemoryId, now);
  return entity;
}

export function attachTranslationMemoryToProject(
  input: AttachTranslationMemoryToProjectInput,
) {
  const repositories = createTranslationMemoryRepositories();
  const entity: ProjectTranslationMemoryEntity = {
    projectId: input.projectId,
    translationMemoryId: input.translationMemoryId,
    accessMode: input.accessMode,
    priority: input.priority,
    createdAt: new Date().toISOString(),
  };

  repositories.projectTranslationMemories.insert(entity);
  return getProjectTranslationMemory(
    input.projectId,
    input.translationMemoryId,
  );
}

export function updateProjectTranslationMemory(
  input: AttachTranslationMemoryToProjectInput,
) {
  getTranslationMemoryDatabase()
    .prepare(
      `
        UPDATE "projectTranslationMemories"
        SET "accessMode" = ?, "priority" = ?
        WHERE "projectId" = ? AND "translationMemoryId" = ?
      `,
    )
    .run(
      input.accessMode,
      input.priority,
      input.projectId,
      input.translationMemoryId,
    );

  return getProjectTranslationMemory(input.projectId, input.translationMemoryId);
}

export function deleteProjectTranslationMemory(
  projectId: string,
  translationMemoryId: string,
) {
  getTranslationMemoryDatabase()
    .prepare(
      `
        DELETE FROM "projectTranslationMemories"
        WHERE "projectId" = ? AND "translationMemoryId" = ?
      `,
    )
    .run(projectId, translationMemoryId);
}

export function listProjectTranslationMemories(projectId: string) {
  const database = getTranslationMemoryDatabase();
  const sql = `
    SELECT
      ptm.projectId,
      ptm.translationMemoryId,
      ptm.accessMode,
      ptm.priority,
      ptm.createdAt AS linkedAt,
      tm.name,
      tm.sourceLanguage,
      tm.targetLanguage,
      tm.lastModifiedAt,
      tm.lastUsedAt,
      tm.createdAt,
      COUNT(t.id) AS termCount
    FROM projectTranslationMemories ptm
    INNER JOIN translationMemories tm ON tm.id = ptm.translationMemoryId
    LEFT JOIN terms t ON t.translationMemoryId = tm.id
    WHERE ptm.projectId = ?
    GROUP BY
      ptm.projectId,
      ptm.translationMemoryId,
      ptm.accessMode,
      ptm.priority,
      ptm.createdAt,
      tm.name,
      tm.sourceLanguage,
      tm.targetLanguage,
      tm.lastModifiedAt,
      tm.lastUsedAt,
      tm.createdAt
    ORDER BY ptm.priority ASC, tm.lastModifiedAt DESC
  `;

  const rows = database.prepare(sql).all(projectId) as Array<
    ProjectTranslationMemoryEntity &
      TranslationMemoryEntity & {
        termCount: number;
        linkedAt: string;
      }
  >;

  return rows.map((row) => ({
    id: row.translationMemoryId,
    projectId: row.projectId,
    translationMemoryId: row.translationMemoryId,
    accessMode: row.accessMode,
    priority: Number(row.priority),
    linkedAt: row.linkedAt,
    name: row.name,
    sourceLanguage: row.sourceLanguage,
    targetLanguage: row.targetLanguage,
    lastModifiedAt: row.lastModifiedAt,
    lastUsedAt: row.lastUsedAt,
    createdAt: row.createdAt,
    termCount: Number(row.termCount ?? 0),
  }));
}

export function getProjectTranslationMemory(
  projectId: string,
  translationMemoryId: string,
) {
  return (
    listProjectTranslationMemories(projectId).find(
      (item) => item.translationMemoryId === translationMemoryId,
    ) ?? null
  );
}

function touchTranslationMemory(translationMemoryId: string, timestamp: string) {
  createTranslationMemoryRepositories().translationMemories.updateById(
    translationMemoryId,
    {
      lastModifiedAt: timestamp,
    },
  );
}

function normalizeTerm(value: string) {
  return value.trim().toLowerCase();
}

function mapTranslationMemorySummary(
  translationMemory: TranslationMemoryEntity & {
    termCount: number;
  },
): TranslationMemorySummary {
  return {
    ...translationMemory,
    termCount: Number(translationMemory.termCount ?? 0),
  };
}
