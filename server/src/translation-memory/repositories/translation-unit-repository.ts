import type { DatabaseSync } from "node:sqlite";
import type { TranslationUnitEntity } from "../entities";
import { BaseRepository } from "./base-repository";

export class TranslationUnitRepository extends BaseRepository<TranslationUnitEntity> {
  constructor(database?: DatabaseSync) {
    super("translation_units", database);
  }
}
