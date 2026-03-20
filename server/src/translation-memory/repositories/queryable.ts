import type { DatabaseSync } from "node:sqlite";

type PrimitiveSqlValue = string | number | bigint | null;

type WhereOperator =
  | "="
  | "!="
  | ">"
  | ">="
  | "<"
  | "<="
  | "LIKE"
  | "IS"
  | "IS NOT";

type SortDirection = "asc" | "desc";

type QueryState<T extends Record<string, unknown>> = {
  selectedColumns: string[];
  whereClauses: string[];
  parameters: PrimitiveSqlValue[];
  orderByClauses: string[];
  limit?: number;
  offset?: number;
  mapRow?: (row: Record<string, unknown>) => T;
};

function quoteIdentifier(identifier: string) {
  return `"${identifier.replace(/"/g, "\"\"")}"`;
}

export class Queryable<T extends Record<string, unknown>> {
  constructor(
    private readonly database: DatabaseSync,
    private readonly tableName: string,
    private readonly state: QueryState<T>,
  ) {}

  where<K extends keyof T & string>(
    field: K,
    value: T[K] extends PrimitiveSqlValue ? T[K] : PrimitiveSqlValue,
  ) {
    return this.whereCondition(field, value === null ? "IS" : "=", value as PrimitiveSqlValue);
  }

  whereCondition<K extends keyof T & string>(
    field: K,
    operator: WhereOperator,
    value: PrimitiveSqlValue,
  ) {
    return this.clone({
      whereClauses: [...this.state.whereClauses, `${quoteIdentifier(field)} ${operator} ?`],
      parameters: [...this.state.parameters, value],
    });
  }

  whereIn<K extends keyof T & string>(field: K, values: PrimitiveSqlValue[]) {
    if (values.length === 0) {
      return this.clone({
        whereClauses: [...this.state.whereClauses, "1 = 0"],
      });
    }

    return this.clone({
      whereClauses: [
        ...this.state.whereClauses,
        `${quoteIdentifier(field)} IN (${values.map(() => "?").join(", ")})`,
      ],
      parameters: [...this.state.parameters, ...values],
    });
  }

  orderBy<K extends keyof T & string>(field: K, direction: SortDirection = "asc") {
    return this.clone({
      orderByClauses: [...this.state.orderByClauses, `${quoteIdentifier(field)} ${direction.toUpperCase()}`],
    });
  }

  skip(count: number) {
    return this.clone({ offset: count });
  }

  take(count: number) {
    return this.clone({ limit: count });
  }

  select<K extends keyof T & string>(...fields: K[]) {
    return new Queryable<Pick<T, K>>(
      this.database,
      this.tableName,
      {
        selectedColumns: fields,
        whereClauses: [...this.state.whereClauses],
        parameters: [...this.state.parameters],
        orderByClauses: [...this.state.orderByClauses],
        limit: this.state.limit,
        offset: this.state.offset,
        mapRow: (row) => row as Pick<T, K>,
      },
    );
  }

  toList() {
    const statement = this.database.prepare(this.buildSelectSql());
    const rows = statement.all(...this.state.parameters) as Record<string, unknown>[];
    return rows.map((row) => (this.state.mapRow ? this.state.mapRow(row) : (row as T)));
  }

  firstOrDefault() {
    const limited = this.take(1);
    const statement = this.database.prepare(limited.buildSelectSql());
    const row = statement.get(...limited.state.parameters) as Record<string, unknown> | undefined;
    if (!row) {
      return null;
    }

    return limited.state.mapRow ? limited.state.mapRow(row) : (row as T);
  }

  any() {
    const sql = this.buildScalarSql("SELECT EXISTS(SELECT 1");
    const row = this.database.prepare(sql).get(...this.state.parameters) as { value: number };
    return row.value === 1;
  }

  count() {
    const sql = this.buildScalarSql("SELECT COUNT(1)");
    const row = this.database.prepare(sql).get(...this.state.parameters) as { value: number };
    return row.value;
  }

  private clone(nextState: Partial<QueryState<T>>) {
    return new Queryable<T>(
      this.database,
      this.tableName,
      {
        ...this.state,
        ...nextState,
      },
    );
  }

  private buildSelectSql() {
    const selectedColumns =
      this.state.selectedColumns.length > 0
        ? this.state.selectedColumns.map((column) => quoteIdentifier(column)).join(", ")
        : "*";

    let sql = `SELECT ${selectedColumns} FROM ${quoteIdentifier(this.tableName)}`;
    sql += this.buildClauses();
    return sql;
  }

  private buildScalarSql(prefix: string) {
    let sql = `${prefix} AS value FROM ${quoteIdentifier(this.tableName)}`;
    sql += this.buildClauses(false);
    return sql;
  }

  private buildClauses(includePaging = true) {
    let sql = "";

    if (this.state.whereClauses.length > 0) {
      sql += ` WHERE ${this.state.whereClauses.join(" AND ")}`;
    }

    if (this.state.orderByClauses.length > 0) {
      sql += ` ORDER BY ${this.state.orderByClauses.join(", ")}`;
    }

    if (includePaging && this.state.limit !== undefined) {
      sql += ` LIMIT ${this.state.limit}`;
    }

    if (includePaging && this.state.offset !== undefined) {
      sql += ` OFFSET ${this.state.offset}`;
    }

    return sql;
  }

}

export function createQueryable<T extends Record<string, unknown>>(
  database: DatabaseSync,
  tableName: string,
) {
  return new Queryable<T>(database, tableName, {
    selectedColumns: [],
    whereClauses: [],
    parameters: [],
    orderByClauses: [],
  });
}
