import type { DatabaseSync } from "node:sqlite";
import type { DocumentEntity } from "../entities";
import { BaseRepository } from "./base-repository";

export class DocumentRepository extends BaseRepository<DocumentEntity> {
  constructor(database?: DatabaseSync) {
    super("documents", database);
  }
}
