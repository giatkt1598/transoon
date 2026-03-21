import type { DatabaseSync } from "node:sqlite";
import { getTranslationMemoryDatabase } from "../database";
import { AppSettingRepository } from "./app-setting-repository";
import { DocumentRepository } from "./document-repository";
import { ProjectRepository } from "./project-repository";
import { ProjectTranslationMemoryRepository } from "./project-translation-memory-repository";
import { SegmentRepository } from "./segment-repository";
import { SegmentTokenRepository } from "./segment-token-repository";
import { TermRepository } from "./term-repository";
import { TranslationMemoryRepository } from "./translation-memory-repository";
import { TranslationUnitRepository } from "./translation-unit-repository";

export type TranslationMemoryRepositories = {
  appSettings: AppSettingRepository;
  projects: ProjectRepository;
  documents: DocumentRepository;
  translationMemories: TranslationMemoryRepository;
  projectTranslationMemories: ProjectTranslationMemoryRepository;
  terms: TermRepository;
  segments: SegmentRepository;
  segmentTokens: SegmentTokenRepository;
  translationUnits: TranslationUnitRepository;
};

export function createTranslationMemoryRepositories(
  database: DatabaseSync = getTranslationMemoryDatabase(),
): TranslationMemoryRepositories {
  return {
    appSettings: new AppSettingRepository(database),
    projects: new ProjectRepository(database),
    documents: new DocumentRepository(database),
    translationMemories: new TranslationMemoryRepository(database),
    projectTranslationMemories: new ProjectTranslationMemoryRepository(database),
    terms: new TermRepository(database),
    segments: new SegmentRepository(database),
    segmentTokens: new SegmentTokenRepository(database),
    translationUnits: new TranslationUnitRepository(database),
  };
}
