import type { DatabaseSync } from "node:sqlite";
import type { ProjectEntity } from "../entities";
import { BaseRepository } from "./base-repository";

export class ProjectRepository extends BaseRepository<ProjectEntity> {
  constructor(database?: DatabaseSync) {
    super("projects", database);
  }
}
