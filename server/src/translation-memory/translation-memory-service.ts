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
  return entity;
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
