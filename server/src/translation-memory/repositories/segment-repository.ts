import type { DatabaseSync } from "node:sqlite";
import type { SegmentEntity } from "../entities";
import { BaseRepository } from "./base-repository";

export class SegmentRepository extends BaseRepository<SegmentEntity> {
  constructor(database?: DatabaseSync) {
    super("segments", database);
  }
}
