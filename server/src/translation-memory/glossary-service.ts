import { randomUUID } from "crypto";
import type {
  GlossaryAppliedItem,
  GlossaryEntity,
  GlossaryItemEntity,
} from "./entities";
import { getTranslationMemoryDatabase } from "./database";
import { createTranslationMemoryRepositories } from "./repositories/repository-service";

export type GlossarySummary = GlossaryEntity & {
  itemCount: number;
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
  appliedGlossary: GlossaryAppliedItem[];
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
  return createTranslationMemoryRepositories().glossaryItems
    .query()
    .where("glossaryId", glossaryId)
    .orderBy("priority", "desc")
    .orderBy("lastModifiedAt", "desc")
    .toList();
}

export function listGlossaryItemsByLanguagePair(
  sourceLanguage: string,
  targetLanguage: string,
) {
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
    ORDER BY gi.priority DESC, LENGTH(gi.source) DESC, gi.source ASC
  `;

  return database.prepare(sql).all(sourceLanguage, targetLanguage) as GlossaryItemEntity[];
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
    wholeWord: input.wholeWord ? 1 : 0,
    priority: Number.isInteger(input.priority) ? Number(input.priority) : 0,
    lastModifiedAt: now,
    lastUsedAt: null,
    createdAt: now,
  };

  repositories.glossaryItems.insert(entity);
  touchGlossary(glossaryId, now);
  return repositories.glossaryItems.getById(entity.id) ?? entity;
}

export function updateGlossaryItem(
  glossaryId: string,
  glossaryItemId: string,
  input: GlossaryItemInput,
) {
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
    wholeWord: input.wholeWord ? 1 : 0,
    priority: Number.isInteger(input.priority) ? Number(input.priority) : 0,
    lastModifiedAt: now,
  });
  touchGlossary(glossaryId, now);
  return repositories.glossaryItems.getById(glossaryItemId);
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

export function getAppliedGlossaryItems(
  sourceText: string,
  glossaryItems: GlossaryItemEntity[],
) {
  return applyGlossaryPreprocess(sourceText, glossaryItems).appliedGlossary;
}

export function applyGlossaryPreprocess(
  sourceText: string,
  glossaryItems: GlossaryItemEntity[],
): GlossaryPreprocessResult {
  let preparedText = sourceText ?? "";
  const appliedGlossary: GlossaryAppliedItem[] = [];
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

export function applyGlossaryPostprocess(
  translatedText: string,
  placeholderTargets: Record<string, string>,
) {
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

function sortGlossaryItems(glossaryItems: GlossaryItemEntity[]) {
  return [...glossaryItems].sort((left, right) => {
    if (right.priority !== left.priority) {
      return right.priority - left.priority;
    }

    if (right.source.length !== left.source.length) {
      return right.source.length - left.source.length;
    }

    return left.source.localeCompare(right.source);
  });
}

function createGlossaryMatcher(glossaryItem: GlossaryItemEntity) {
  const flags = glossaryItem.caseSensitive ? "gu" : "giu";
  const escapedSource = escapeRegExp(glossaryItem.source);
  const pattern = glossaryItem.wholeWord
    ? `(?<![\\p{L}\\p{N}_])${escapedSource}(?![\\p{L}\\p{N}_])`
    : escapedSource;

  return new RegExp(pattern, flags);
}

function mapAppliedGlossaryItem(glossaryItem: GlossaryItemEntity): GlossaryAppliedItem {
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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
