import type { DatabaseSync } from "node:sqlite";
import type { GlossaryEntity } from "../entities";
import { BaseRepository } from "./base-repository";

export class GlossaryRepository extends BaseRepository<GlossaryEntity> {
  constructor(database?: DatabaseSync) {
    super("glossaries", database);
  }
}
