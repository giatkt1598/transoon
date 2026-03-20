import type { DatabaseSync } from "node:sqlite";
import { getTranslationMemoryDatabase } from "../database";
import { DocumentRepository } from "./document-repository";
import { ProjectRepository } from "./project-repository";
import { SegmentRepository } from "./segment-repository";
import { SegmentTokenRepository } from "./segment-token-repository";
import { TranslationUnitRepository } from "./translation-unit-repository";

export type TranslationMemoryRepositories = {
  projects: ProjectRepository;
  documents: DocumentRepository;
  segments: SegmentRepository;
  segmentTokens: SegmentTokenRepository;
  translationUnits: TranslationUnitRepository;
};

export function createTranslationMemoryRepositories(
  database: DatabaseSync = getTranslationMemoryDatabase(),
): TranslationMemoryRepositories {
  return {
    projects: new ProjectRepository(database),
    documents: new DocumentRepository(database),
    segments: new SegmentRepository(database),
    segmentTokens: new SegmentTokenRepository(database),
    translationUnits: new TranslationUnitRepository(database),
  };
}
