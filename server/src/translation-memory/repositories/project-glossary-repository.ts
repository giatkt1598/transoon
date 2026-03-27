import type { DatabaseSync } from "node:sqlite";
import type { ProjectGlossaryEntity } from "../entities";
import { BaseRepository } from "./base-repository";

export class ProjectGlossaryRepository extends BaseRepository<ProjectGlossaryEntity> {
  constructor(database?: DatabaseSync) {
    super("projectGlossaries", database);
  }
}
