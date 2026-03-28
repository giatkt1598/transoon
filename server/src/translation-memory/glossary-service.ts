import { randomUUID } from "crypto";
import type { GlossaryAppliedItem, GlossaryEntity, GlossaryItemEntity, ProjectGlossaryEntity } from "./entities";
import { getTranslationMemoryDatabase } from "./database";
import { createTranslationMemoryRepositories } from "./repositories/repository-service";

export type GlossarySummary = GlossaryEntity & {
  itemCount: number;
};

export type GlossaryItem = Omit<GlossaryItemEntity, "caseSensitive" | "wholeWord"> & {
  caseSensitive: boolean;
  wholeWord: boolean;
};

export type AppliedGlossaryItemView = Omit<GlossaryAppliedItem, "caseSensitive" | "wholeWord"> & {
  caseSensitive: boolean;
  wholeWord: boolean;
};

export type AttachGlossaryToProjectInput = {
  projectId: string;
  glossaryId: string;
  priority: number;
};

export type ProjectGlossarySummary = ProjectGlossaryEntity &
  GlossarySummary & {
    linkedAt: string;
  };

export type CreateGlossaryInput = {
  name: string;
  sourceLanguage: string;
  targetLanguage: string;
};

export type GlossaryItemInput = {
  source: string;
  target: string;
  caseSensitive?: boolean;
  wholeWord?: boolean;
  priority?: number;
};

export type GlossaryPreprocessResult = {
  preparedText: string;
  appliedGlossary: AppliedGlossaryItemView[];
  placeholderTargets: Record<string, string>;
};

export function listGlossaries() {
  const database = getTranslationMemoryDatabase();
  const sql = `
    SELECT
      g.id,
      g.name,
      g.sourceLanguage,
      g.targetLanguage,
      g.lastModifiedAt,
      g.lastUsedAt,
      g.createdAt,
      COUNT(gi.id) AS itemCount
    FROM glossaries g
    LEFT JOIN glossaryItems gi ON gi.glossaryId = g.id
    GROUP BY
      g.id,
      g.name,
      g.sourceLanguage,
      g.targetLanguage,
      g.lastModifiedAt,
      g.lastUsedAt,
      g.createdAt
    ORDER BY g.lastModifiedAt DESC
  `;

  return database.prepare(sql).all() as GlossarySummary[];
}

export function getGlossaryById(glossaryId: string) {
  return listGlossaries().find((glossary) => glossary.id === glossaryId) ?? null;
}

export function listGlossaryItems(glossaryId: string) {
  const glossaryItems = createTranslationMemoryRepositories()
    .glossaryItems.query()
    .where("glossaryId", glossaryId)
    .orderBy("createdAt", "desc")
    .toList();

  return glossaryItems.map(mapGlossaryItemEntity);
}

export function listGlossaryItemsByLanguagePair(sourceLanguage: string, targetLanguage: string) {
  const database = getTranslationMemoryDatabase();
  const sql = `
    SELECT
      gi.id,
      gi.glossaryId,
      gi.source,
      gi.sourceNormalized,
      gi.target,
      gi.targetNormalized,
      gi.caseSensitive,
      gi.wholeWord,
      gi.priority,
      gi.lastModifiedAt,
      gi.lastUsedAt,
      gi.createdAt
    FROM glossaryItems gi
    INNER JOIN glossaries g ON g.id = gi.glossaryId
    WHERE g.sourceLanguage = ? AND g.targetLanguage = ?
    ORDER BY LENGTH(gi.source) DESC, gi.priority DESC, gi.source ASC
  `;

  const glossaryItems = database.prepare(sql).all(sourceLanguage, targetLanguage) as GlossaryItemEntity[];
  return glossaryItems.map(mapGlossaryItemEntity);
}

export function attachGlossaryToProject(input: AttachGlossaryToProjectInput) {
  const repositories = createTranslationMemoryRepositories();
  const entity: ProjectGlossaryEntity = {
    projectId: input.projectId,
    glossaryId: input.glossaryId,
    priority: input.priority,
    createdAt: new Date().toISOString(),
  };

  repositories.projectGlossaries.insert(entity);
  return getProjectGlossary(input.projectId, input.glossaryId);
}

export function updateProjectGlossary(input: AttachGlossaryToProjectInput) {
  getTranslationMemoryDatabase()
    .prepare(
      `
        UPDATE "projectGlossaries"
        SET "priority" = ?
        WHERE "projectId" = ? AND "glossaryId" = ?
      `,
    )
    .run(input.priority, input.projectId, input.glossaryId);

  return getProjectGlossary(input.projectId, input.glossaryId);
}

export function deleteProjectGlossary(projectId: string, glossaryId: string) {
  getTranslationMemoryDatabase()
    .prepare(
      `
        DELETE FROM "projectGlossaries"
        WHERE "projectId" = ? AND "glossaryId" = ?
      `,
    )
    .run(projectId, glossaryId);
}

export function listProjectGlossaries(projectId: string) {
  const database = getTranslationMemoryDatabase();
  const sql = `
    SELECT
      pg.projectId,
      pg.glossaryId,
      pg.priority,
      pg.createdAt AS linkedAt,
      g.name,
      g.sourceLanguage,
      g.targetLanguage,
      g.lastModifiedAt,
      g.lastUsedAt,
      g.createdAt,
      COUNT(gi.id) AS itemCount
    FROM projectGlossaries pg
    INNER JOIN glossaries g ON g.id = pg.glossaryId
    LEFT JOIN glossaryItems gi ON gi.glossaryId = g.id
    WHERE pg.projectId = ?
    GROUP BY
      pg.projectId,
      pg.glossaryId,
      pg.priority,
      pg.createdAt,
      g.name,
      g.sourceLanguage,
      g.targetLanguage,
      g.lastModifiedAt,
      g.lastUsedAt,
      g.createdAt
    ORDER BY pg.priority ASC, g.lastModifiedAt DESC
  `;

  return database.prepare(sql).all(projectId) as ProjectGlossarySummary[];
}

export function getProjectGlossary(projectId: string, glossaryId: string) {
  return listProjectGlossaries(projectId).find((item) => item.glossaryId === glossaryId) ?? null;
}

export function listProjectGlossaryItems(projectId: string) {
  const database = getTranslationMemoryDatabase();
  const sql = `
    SELECT
      gi.id,
      gi.glossaryId,
      gi.source,
      gi.sourceNormalized,
      gi.target,
      gi.targetNormalized,
      gi.caseSensitive,
      gi.wholeWord,
      gi.priority,
      gi.lastModifiedAt,
      gi.lastUsedAt,
      gi.createdAt
    FROM projectGlossaries pg
    INNER JOIN glossaries g ON g.id = pg.glossaryId
    INNER JOIN glossaryItems gi ON gi.glossaryId = g.id
    WHERE pg.projectId = ?
    ORDER BY pg.priority ASC, LENGTH(gi.source) DESC, gi.priority DESC, gi.source ASC
  `;

  const glossaryItems = database.prepare(sql).all(projectId) as GlossaryItemEntity[];
  return glossaryItems.map(mapGlossaryItemEntity);
}

export function createGlossary(input: CreateGlossaryInput) {
  const repositories = createTranslationMemoryRepositories();
  const now = new Date().toISOString();
  const entity: GlossaryEntity = {
    id: randomUUID(),
    name: input.name.trim(),
    sourceLanguage: input.sourceLanguage,
    targetLanguage: input.targetLanguage,
    lastModifiedAt: now,
    lastUsedAt: null,
    createdAt: now,
  };

  repositories.glossaries.insert(entity);
  return getGlossaryById(entity.id);
}

export function updateGlossary(glossaryId: string, input: CreateGlossaryInput) {
  const now = new Date().toISOString();
  createTranslationMemoryRepositories().glossaries.updateById(glossaryId, {
    name: input.name.trim(),
    sourceLanguage: input.sourceLanguage,
    targetLanguage: input.targetLanguage,
    lastModifiedAt: now,
  });

  return getGlossaryById(glossaryId);
}

export function deleteGlossary(glossaryId: string) {
  createTranslationMemoryRepositories().glossaries.deleteById(glossaryId);
}

export function createGlossaryItem(glossaryId: string, input: GlossaryItemInput) {
  const repositories = createTranslationMemoryRepositories();
  const now = new Date().toISOString();
  const source = input.source.trim();
  const target = input.target.trim();

  if (!source || !target) {
    throw new Error("Glossary items require both source and target text.");
  }

  const entity: GlossaryItemEntity = {
    id: randomUUID(),
    glossaryId,
    source,
    sourceNormalized: normalizeGlossaryText(source),
    target,
    targetNormalized: normalizeGlossaryText(target),
    caseSensitive: input.caseSensitive ? 1 : 0,
    wholeWord: (input.wholeWord ?? true) ? 1 : 0,
    priority: 1,
    lastModifiedAt: now,
    lastUsedAt: null,
    createdAt: now,
  };

  repositories.glossaryItems.insert(entity);
  touchGlossary(glossaryId, now);
  return mapGlossaryItemEntity(repositories.glossaryItems.getById(entity.id) ?? entity);
}

export function updateGlossaryItem(glossaryId: string, glossaryItemId: string, input: GlossaryItemInput) {
  const repositories = createTranslationMemoryRepositories();
  const existingItem = repositories.glossaryItems.getById(glossaryItemId);
  if (!existingItem || existingItem.glossaryId !== glossaryId) {
    return null;
  }

  const source = input.source.trim();
  const target = input.target.trim();
  if (!source || !target) {
    throw new Error("Glossary items require both source and target text.");
  }

  const now = new Date().toISOString();
  repositories.glossaryItems.updateById(glossaryItemId, {
    source,
    sourceNormalized: normalizeGlossaryText(source),
    target,
    targetNormalized: normalizeGlossaryText(target),
    caseSensitive: input.caseSensitive ? 1 : 0,
    wholeWord: (input.wholeWord ?? true) ? 1 : 0,
    priority: 1,
    lastModifiedAt: now,
  });
  touchGlossary(glossaryId, now);
  const updatedItem = repositories.glossaryItems.getById(glossaryItemId);
  return updatedItem ? mapGlossaryItemEntity(updatedItem) : null;
}

export function deleteGlossaryItem(glossaryId: string, glossaryItemId: string) {
  const repositories = createTranslationMemoryRepositories();
  const existingItem = repositories.glossaryItems.getById(glossaryItemId);
  if (!existingItem || existingItem.glossaryId !== glossaryId) {
    return;
  }

  repositories.glossaryItems.deleteById(glossaryItemId);
  touchGlossary(glossaryId);
}

export function getAppliedGlossaryItems(sourceText: string, glossaryItems: GlossaryItem[]) {
  return applyGlossaryPreprocess(sourceText, glossaryItems).appliedGlossary;
}

export function applyGlossaryPreprocess(sourceText: string, glossaryItems: GlossaryItem[]): GlossaryPreprocessResult {
  let preparedText = sourceText ?? "";
  const appliedGlossary: AppliedGlossaryItemView[] = [];
  const placeholderTargets: Record<string, string> = {};
  let placeholderIndex = 1;

  for (const glossaryItem of sortGlossaryItems(glossaryItems)) {
    if (!glossaryItem.source.trim()) {
      continue;
    }

    const matcher = createGlossaryMatcher(glossaryItem);
    const nextPlaceholder = `⟦G${placeholderIndex}⟧`;
    let matched = false;
    preparedText = preparedText.replace(matcher, () => {
      matched = true;
      return nextPlaceholder;
    });

    if (!matched) {
      continue;
    }

    placeholderTargets[nextPlaceholder] = glossaryItem.target;
    appliedGlossary.push(mapAppliedGlossaryItem(glossaryItem));
    placeholderIndex += 1;
  }

  return {
    preparedText,
    appliedGlossary,
    placeholderTargets,
  };
}

export function applyGlossaryPostprocess(translatedText: string, placeholderTargets: Record<string, string>) {
  let nextText = translatedText ?? "";

  for (const [placeholder, target] of Object.entries(placeholderTargets)) {
    nextText = nextText.split(placeholder).join(target);
  }

  return nextText;
}

function touchGlossary(glossaryId: string, now = new Date().toISOString()) {
  createTranslationMemoryRepositories().glossaries.updateById(glossaryId, {
    lastModifiedAt: now,
  });
}

function normalizeGlossaryText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function sortGlossaryItems(glossaryItems: GlossaryItem[]) {
  return [...glossaryItems].sort((left, right) => {
    if (right.source.length !== left.source.length) {
      return right.source.length - left.source.length;
    }

    if (right.priority !== left.priority) {
      return right.priority - left.priority;
    }

    return left.source.localeCompare(right.source);
  });
}

function createGlossaryMatcher(glossaryItem: GlossaryItem) {
  const flags = glossaryItem.caseSensitive ? "gu" : "giu";
  const escapedSource = escapeRegExp(glossaryItem.source);
  const pattern = glossaryItem.wholeWord ? `(?<![\\p{L}\\p{N}_])${escapedSource}(?![\\p{L}\\p{N}_])` : escapedSource;

  return new RegExp(pattern, flags);
}

function mapAppliedGlossaryItem(glossaryItem: GlossaryItem): AppliedGlossaryItemView {
  return {
    id: glossaryItem.id,
    glossaryId: glossaryItem.glossaryId,
    source: glossaryItem.source,
    target: glossaryItem.target,
    caseSensitive: glossaryItem.caseSensitive,
    wholeWord: glossaryItem.wholeWord,
    priority: glossaryItem.priority,
  };
}

function mapGlossaryItemEntity(glossaryItem: GlossaryItemEntity): GlossaryItem {
  return {
    ...glossaryItem,
    caseSensitive: glossaryItem.caseSensitive === 1,
    wholeWord: glossaryItem.wholeWord === 1,
  };
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
