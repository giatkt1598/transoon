import type { DatabaseSync } from "node:sqlite";
import type { TermEntity } from "../entities";
import { BaseRepository } from "./base-repository";

export class TermRepository extends BaseRepository<TermEntity> {
  constructor(database?: DatabaseSync) {
    super("terms", database);
  }
}
