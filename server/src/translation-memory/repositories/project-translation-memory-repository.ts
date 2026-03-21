import type { DatabaseSync } from "node:sqlite";
import type { ProjectTranslationMemoryEntity } from "../entities";
import { BaseRepository } from "./base-repository";

export class ProjectTranslationMemoryRepository extends BaseRepository<ProjectTranslationMemoryEntity> {
  constructor(database?: DatabaseSync) {
    super("projectTranslationMemories", database);
  }
}
