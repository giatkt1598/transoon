import type { DatabaseSync } from "node:sqlite";
import { createHash, randomUUID } from "crypto";
import type {
  ProjectTranslationMemoryEntity,
  TermEntity,
  TranslationUnitEntity,
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

export type UpsertTranslationMemoryTermInput = {
  translationMemoryId: string;
  sourceTerm: string;
  targetTerm: string;
  database?: DatabaseSync;
};

export type UpsertTranslationMemoryTermResult = {
  term: TermEntity;
  inserted: boolean;
  conflict: boolean;
};

export type UpsertTranslationUnitInput = {
  translationMemoryId: string;
  projectId: string | null;
  sourceLanguage: string;
  targetLanguage: string;
  sourceText: string;
  targetText: string;
  originDocumentId: string | null;
  originSegmentId: string | null;
  providerName: string | null;
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

export type ProjectTermSummary = TermEntity & {
  name: string;
  sourceLanguage: string;
  targetLanguage: string;
  accessMode: TranslationMemoryAccessMode;
  priority: number;
};

export type TranslationMemoryTermInput = {
  sourceTerm: string;
  targetTerm: string;
};

export type SaveTranslationMemoryTermsChangesInput = {
  createdItems: TranslationMemoryTermInput[];
  updatedItems: Array<
    TranslationMemoryTermInput & {
      id: string;
    }
  >;
  deletedItemIds: string[];
};

export type TranslationMemoryTermSummary = TermEntity;

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

export function listTranslationMemoryTerms(
  translationMemoryId: string,
): TranslationMemoryTermSummary[] {
  return createTranslationMemoryRepositories().terms
    .query()
    .where("translationMemoryId", translationMemoryId)
    .orderBy("lastModifiedAt", "desc")
    .toList();
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

export function updateTranslationMemoryTerm(
  translationMemoryId: string,
  termId: string,
  input: Pick<CreateTermInput, "sourceTerm" | "targetTerm">,
) {
  const repositories = createTranslationMemoryRepositories();
  const existingTerm = repositories.terms.getById(termId);
  if (!existingTerm || existingTerm.translationMemoryId !== translationMemoryId) {
    return null;
  }

  const sourceTerm = input.sourceTerm.trim();
  const targetTerm = input.targetTerm.trim();
  if (!sourceTerm || !targetTerm) {
    throw new Error("Translation memory terms require both source and target text.");
  }

  const sourceTermNormalized = normalizeTerm(sourceTerm);
  const duplicateTerm = repositories.terms
    .query()
    .where("translationMemoryId", translationMemoryId)
    .where("sourceTermNormalized", sourceTermNormalized)
    .toList()
    .find((term) => term.id !== termId);
  if (duplicateTerm) {
    throw new Error("Another term with the same source text already exists.");
  }

  const now = new Date().toISOString();
  repositories.terms.updateById(termId, {
    sourceTerm,
    sourceTermNormalized,
    targetTerm,
    targetTermNormalized: normalizeTerm(targetTerm),
    lastModifiedAt: now,
  });
  touchTranslationMemory(translationMemoryId, now);
  return repositories.terms.getById(termId);
}

export function deleteTranslationMemoryTerm(
  translationMemoryId: string,
  termId: string,
) {
  const repositories = createTranslationMemoryRepositories();
  const existingTerm = repositories.terms.getById(termId);
  if (!existingTerm || existingTerm.translationMemoryId !== translationMemoryId) {
    return;
  }

  repositories.terms.deleteById(termId);
  touchTranslationMemory(translationMemoryId);
}

export function saveTranslationMemoryTermsChanges(
  translationMemoryId: string,
  input: SaveTranslationMemoryTermsChangesInput,
) {
  const database = getTranslationMemoryDatabase();
  const repositories = createTranslationMemoryRepositories(database);
  const translationMemory =
    repositories.translationMemories.getById(translationMemoryId);
  if (!translationMemory) {
    throw new Error("Translation memory not found.");
  }

  const now = new Date().toISOString();
  database.exec("BEGIN");

  try {
    for (const termId of input.deletedItemIds) {
      const existingTerm = repositories.terms.getById(termId);
      if (!existingTerm || existingTerm.translationMemoryId !== translationMemoryId) {
        continue;
      }

      repositories.terms.deleteById(termId);
    }

    const seenNormalizedSources = new Map<string, string>();
    const existingTerms = repositories.terms
      .query()
      .where("translationMemoryId", translationMemoryId)
      .toList();

    for (const existingTerm of existingTerms) {
      if (input.deletedItemIds.includes(existingTerm.id)) {
        continue;
      }

      seenNormalizedSources.set(
        existingTerm.sourceTermNormalized,
        existingTerm.id,
      );
    }

    for (const item of input.updatedItems) {
      const existingTerm = repositories.terms.getById(item.id);
      if (!existingTerm || existingTerm.translationMemoryId !== translationMemoryId) {
        continue;
      }

      const sourceTerm = item.sourceTerm.trim();
      const targetTerm = item.targetTerm.trim();
      if (!sourceTerm || !targetTerm) {
        continue;
      }

      const sourceTermNormalized = normalizeTerm(sourceTerm);
      const duplicateTermId = seenNormalizedSources.get(sourceTermNormalized);
      if (duplicateTermId && duplicateTermId !== item.id) {
        throw new Error("Another term with the same source text already exists.");
      }

      repositories.terms.updateById(item.id, {
        sourceTerm,
        sourceTermNormalized,
        targetTerm,
        targetTermNormalized: normalizeTerm(targetTerm),
        lastModifiedAt: now,
      });
      seenNormalizedSources.set(sourceTermNormalized, item.id);
    }

    for (const item of input.createdItems) {
      const sourceTerm = item.sourceTerm.trim();
      const targetTerm = item.targetTerm.trim();
      if (!sourceTerm || !targetTerm) {
        continue;
      }

      const sourceTermNormalized = normalizeTerm(sourceTerm);
      if (seenNormalizedSources.has(sourceTermNormalized)) {
        throw new Error("Another term with the same source text already exists.");
      }

      const entity: TermEntity = {
        id: randomUUID(),
        translationMemoryId,
        sourceTerm,
        sourceTermNormalized,
        targetTerm,
        targetTermNormalized: normalizeTerm(targetTerm),
        lastModifiedAt: now,
        lastUsedAt: null,
        createdAt: now,
      };

      repositories.terms.insert(entity);
      seenNormalizedSources.set(sourceTermNormalized, entity.id);
    }

    repositories.translationMemories.updateById(translationMemoryId, {
      lastModifiedAt: now,
    });

    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }

  return listTranslationMemoryTerms(translationMemoryId);
}

export function upsertTranslationMemoryTerm(
  input: UpsertTranslationMemoryTermInput,
): UpsertTranslationMemoryTermResult {
  const repositories = createTranslationMemoryRepositories(input.database);
  const now = new Date().toISOString();
  const sourceTerm = input.sourceTerm.trim();
  const targetTerm = input.targetTerm.trim();

  if (!sourceTerm || !targetTerm) {
    throw new Error("Translation memory terms require both source and target text.");
  }

  const sourceTermNormalized = normalizeTerm(sourceTerm);
  const targetTermNormalized = normalizeTerm(targetTerm);
  const existingTerm = repositories.terms
    .query()
    .where("translationMemoryId", input.translationMemoryId)
    .where("sourceTermNormalized", sourceTermNormalized)
    .firstOrDefault();

  if (existingTerm) {
    repositories.terms.updateById(existingTerm.id, {
      sourceTerm,
      sourceTermNormalized,
      targetTerm,
      targetTermNormalized,
      lastModifiedAt: now,
      lastUsedAt: now,
    });
    touchTranslationMemory(input.translationMemoryId, now);
    const updatedTerm = repositories.terms.getById(existingTerm.id) ?? {
      ...existingTerm,
      sourceTerm,
      sourceTermNormalized,
      targetTerm,
      targetTermNormalized,
      lastModifiedAt: now,
      lastUsedAt: now,
    };
    return {
      term: updatedTerm,
      inserted: false,
      conflict: false,
    };
  }

  const entity: TermEntity = {
    id: randomUUID(),
    translationMemoryId: input.translationMemoryId,
    sourceTerm,
    sourceTermNormalized,
    targetTerm,
    targetTermNormalized,
    lastModifiedAt: now,
    lastUsedAt: now,
    createdAt: now,
  };

  repositories.terms.insert(entity);
  touchTranslationMemory(input.translationMemoryId, now);
  return {
    term: repositories.terms.getById(entity.id) ?? entity,
    inserted: true,
    conflict: false,
  };
}

export function upsertTranslationMemoryUnit(input: UpsertTranslationUnitInput) {
  const repositories = createTranslationMemoryRepositories();
  const now = new Date().toISOString();
  const sourceText = input.sourceText.trim();
  const targetText = input.targetText.trim();

  if (!sourceText || !targetText) {
    throw new Error(
      "Translation memory entries require both source and target text.",
    );
  }

  const sourceTextNormalized = normalizeTerm(sourceText);
  const targetTextNormalized = normalizeTerm(targetText);
  const sourceTextHash = hashValue(sourceText);
  const targetTextHash = hashValue(targetText);

  const existingUnit = repositories.translationUnits
    .query()
    .where("translationMemoryId", input.translationMemoryId)
    .where("sourceLanguage", input.sourceLanguage)
    .where("targetLanguage", input.targetLanguage)
    .where("sourceTextHash", sourceTextHash)
    .firstOrDefault();

  if (existingUnit) {
    repositories.translationUnits.updateById(existingUnit.id, {
      projectId: input.projectId,
      translationMemoryId: input.translationMemoryId,
      sourceText,
      sourceTextNormalized,
      sourceTextHash,
      targetText,
      targetTextNormalized,
      targetTextHash,
      tokensJson: JSON.stringify([{ type: "text", value: sourceText }]),
      originDocumentId: input.originDocumentId,
      originSegmentId: input.originSegmentId,
      providerName: input.providerName,
      matchQuality: "human_approved",
      lastUsedAt: now,
      updatedAt: now,
    });
    touchTranslationMemory(input.translationMemoryId, now);
    return repositories.translationUnits.getById(existingUnit.id);
  }

  const entity: TranslationUnitEntity = {
    id: randomUUID(),
    projectId: input.projectId,
    translationMemoryId: input.translationMemoryId,
    sourceLanguage: input.sourceLanguage,
    targetLanguage: input.targetLanguage,
    sourceText,
    sourceTextNormalized,
    sourceTextHash,
    targetText,
    targetTextNormalized,
    targetTextHash,
    tokensJson: JSON.stringify([{ type: "text", value: sourceText }]),
    originDocumentId: input.originDocumentId,
    originSegmentId: input.originSegmentId,
    providerName: input.providerName,
    matchQuality: "human_approved",
    useCount: 0,
    lastUsedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  repositories.translationUnits.insert(entity);
  touchTranslationMemory(input.translationMemoryId, now);
  return repositories.translationUnits.getById(entity.id);
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

export function listProjectTerms(projectId: string): ProjectTermSummary[] {
  const database = getTranslationMemoryDatabase();
  const sql = `
    SELECT
      t.id,
      t.translationMemoryId,
      t.sourceTerm,
      t.sourceTermNormalized,
      t.targetTerm,
      t.targetTermNormalized,
      t.lastModifiedAt,
      t.lastUsedAt,
      t.createdAt,
      tm.name,
      tm.sourceLanguage,
      tm.targetLanguage,
      ptm.accessMode,
      ptm.priority
    FROM projectTranslationMemories ptm
    INNER JOIN translationMemories tm ON tm.id = ptm.translationMemoryId
    INNER JOIN terms t ON t.translationMemoryId = ptm.translationMemoryId
    WHERE ptm.projectId = ?
    ORDER BY ptm.priority ASC, CASE WHEN ptm.accessMode = 'write' THEN 0 ELSE 1 END ASC, t.lastModifiedAt DESC
  `;

  return database.prepare(sql).all(projectId) as ProjectTermSummary[];
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

function touchTranslationMemory(
  translationMemoryId: string,
  timestamp = new Date().toISOString(),
) {
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

function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
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
