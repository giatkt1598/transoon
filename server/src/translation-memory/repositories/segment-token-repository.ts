import type { DatabaseSync } from "node:sqlite";
import type { SegmentTokenEntity } from "../entities";
import { BaseRepository } from "./base-repository";

export class SegmentTokenRepository extends BaseRepository<SegmentTokenEntity> {
  constructor(database?: DatabaseSync) {
    super("segment_tokens", database);
  }
}
