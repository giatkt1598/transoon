import type { DatabaseSync } from "node:sqlite";
import type { AppSettingEntity } from "../entities";
import { BaseRepository } from "./base-repository";

export class AppSettingRepository extends BaseRepository<AppSettingEntity> {
  constructor(database?: DatabaseSync) {
    super("appSettings", database);
  }

  getByKey(key: string) {
    return (
      this.query().where("key", key).firstOrDefault() ?? null
    );
  }

  upsert(setting: AppSettingEntity) {
    const sql = `
      INSERT INTO "appSettings" ("key", value, updatedAt)
      VALUES (?, ?, ?)
      ON CONFLICT("key") DO UPDATE SET
        value = excluded.value,
        updatedAt = excluded.updatedAt
    `;

    this.database
      .prepare(sql)
      .run(setting.key, setting.value, setting.updatedAt);
  }
}
