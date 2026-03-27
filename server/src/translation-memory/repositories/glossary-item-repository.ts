import type { DatabaseSync } from "node:sqlite";
import type { GlossaryItemEntity } from "../entities";
import { BaseRepository } from "./base-repository";

export class GlossaryItemRepository extends BaseRepository<GlossaryItemEntity> {
  constructor(database?: DatabaseSync) {
    super("glossaryItems", database);
  }
}
