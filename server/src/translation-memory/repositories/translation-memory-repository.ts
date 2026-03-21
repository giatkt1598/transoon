import type { DatabaseSync } from "node:sqlite";
import type { TranslationMemoryEntity } from "../entities";
import { BaseRepository } from "./base-repository";

export class TranslationMemoryRepository extends BaseRepository<TranslationMemoryEntity> {
  constructor(database?: DatabaseSync) {
    super("translationMemories", database);
  }
}
