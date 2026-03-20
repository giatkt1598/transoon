import type { DatabaseSync } from "node:sqlite";
import { getTranslationMemoryDatabase } from "../database";
import { createQueryable } from "./queryable";

type PrimitiveSqlValue = string | number | bigint | null;

type Insertable<T> = Partial<T> & Record<string, PrimitiveSqlValue>;

function quoteIdentifier(identifier: string) {
  return `"${identifier.replace(/"/g, "\"\"")}"`;
}

export abstract class BaseRepository<T extends Record<string, unknown>> {
  protected readonly database: DatabaseSync;

  protected constructor(
    protected readonly tableName: string,
    database?: DatabaseSync,
  ) {
    this.database = database ?? getTranslationMemoryDatabase();
  }

  query() {
    return createQueryable<T>(this.database, this.tableName);
  }

  getAll() {
    return this.query().toList();
  }

  getById(id: string | number) {
    return this.query().where("id" as keyof T & string, id as never).firstOrDefault();
  }

  insert(entity: Insertable<T>) {
    const entries = Object.entries(entity).filter(([, value]) => value !== undefined);
    const columns = entries.map(([column]) => quoteIdentifier(column));
    const placeholders = entries.map(() => "?");
    const values = entries.map(([, value]) => value as PrimitiveSqlValue);

    const sql = `
      INSERT INTO ${quoteIdentifier(this.tableName)} (${columns.join(", ")})
      VALUES (${placeholders.join(", ")})
    `;

    this.database.prepare(sql).run(...values);
  }

  updateById(id: string | number, patch: Partial<T> & Record<string, PrimitiveSqlValue>) {
    const entries = Object.entries(patch).filter(([, value]) => value !== undefined);
    if (entries.length === 0) {
      return;
    }

    const assignments = entries.map(([column]) => `${quoteIdentifier(column)} = ?`);
    const values = entries.map(([, value]) => value as PrimitiveSqlValue);

    const sql = `
      UPDATE ${quoteIdentifier(this.tableName)}
      SET ${assignments.join(", ")}
      WHERE "id" = ?
    `;

    this.database.prepare(sql).run(...values, id);
  }

  deleteById(id: string | number) {
    const sql = `DELETE FROM ${quoteIdentifier(this.tableName)} WHERE "id" = ?`;
    this.database.prepare(sql).run(id);
  }
}
