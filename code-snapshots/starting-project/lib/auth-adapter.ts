import type { Database, SQLQueryBindings } from "bun:sqlite";
import {
  createAdapterFactory,
  type CleanedWhere,
  type CustomAdapter,
  type DBAdapter,
  type DBAdapterInstance,
} from "better-auth/adapters";

// Identifiers come from Better Auth's schema, never from form values.
function identifier(value: string) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error("Invalid auth database identifier.");
  }
  return `"${value}"`;
}

function binding(value: unknown): SQLQueryBindings {
  if (value === null || typeof value === "string" || typeof value === "number") return value;
  throw new Error("Unsupported auth database value.");
}

function conditions(where: CleanedWhere[] = []) {
  const values: SQLQueryBindings[] = [];
  const and: string[] = [];
  const or: string[] = [];

  // Better Auth groups all AND predicates before the OR predicates.
  const grouped = [
    ...where.filter((item) => item.connector !== "OR"),
    ...where.filter((item) => item.connector === "OR"),
  ];
  for (const condition of grouped) {
    const { operator, value, mode, connector } = condition;
    const column = identifier(condition.field);
    const field = mode === "insensitive" ? `LOWER(${column})` : column;
    const normalize = (item: unknown) =>
      binding(mode === "insensitive" && typeof item === "string" ? item.toLowerCase() : item);
    let sql: string;

    if (value === null && (operator === "eq" || operator === "ne")) {
      sql = `${field} IS ${operator === "ne" ? "NOT " : ""}NULL`;
    } else if (operator === "in" || operator === "not_in") {
      if (!Array.isArray(value)) throw new Error("Expected an array for an auth query.");
      sql = value.length
        ? `${field} ${operator === "in" ? "IN" : "NOT IN"} (${value.map(() => "?").join(", ")})`
        : operator === "in"
          ? "0"
          : "1";
      values.push(...value.map(normalize));
    } else if (operator === "contains" || operator === "starts_with" || operator === "ends_with") {
      // instr/substr treat % and _ literally and preserve case-sensitive token matching.
      const text = normalize(value);
      if (typeof text !== "string") throw new Error("Expected text for an auth query.");
      if (operator === "contains") {
        sql = `instr(${field}, ?) > 0`;
        values.push(text);
      } else {
        sql =
          operator === "starts_with"
            ? `substr(${field}, 1, length(?)) = ?`
            : `substr(${field}, length(${field}) - length(?) + 1) = ?`;
        values.push(text, text);
      }
    } else {
      const operators = { eq: "=", ne: "!=", lt: "<", lte: "<=", gt: ">", gte: ">=" };
      const comparison = operators[operator];
      if (!comparison) throw new Error("Unsupported auth query operator.");
      sql = `${field} ${comparison} ?`;
      values.push(normalize(value));
    }

    (connector === "OR" ? or : and).push(sql);
  }

  const groups = [
    and.length ? `(${and.join(" AND ")})` : "",
    or.length ? `(${or.join(" OR ")})` : "",
  ].filter(Boolean);
  return { sql: groups.length ? ` WHERE ${groups.join(" OR ")}` : "", values };
}

function assignments(data: object) {
  const entries = Object.entries(data).filter(([, value]) => value !== undefined);
  return {
    sql: entries.map(([key]) => `${identifier(key)} = ?`).join(", "),
    values: entries.map(([, value]) => binding(value)),
  };
}

export function bunSqliteAdapter(getDatabase: () => Database): DBAdapterInstance {
  // Bun's db.transaction() is synchronous. Queue all adapter work so an async
  // Better Auth transaction cannot accidentally include another request's writes.
  let pending = Promise.resolve();
  function exclusive<T>(operation: () => T | Promise<T>): Promise<T> {
    const result = pending.then(operation);
    pending = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  return (options) => {
    const build = (inTransaction: boolean): DBAdapter => {
      const run = <T>(operation: (db: Database) => T): Promise<T> =>
        inTransaction
          ? Promise.resolve().then(() => operation(getDatabase()))
          : exclusive(() => operation(getDatabase()));

      return createAdapterFactory({
        config: {
          adapterId: "bun-sqlite",
          supportsDates: false,
          supportsBooleans: false,
          supportsJSON: false,
          supportsArrays: false,
          supportsNumericIds: false,
          transaction: inTransaction
            ? false
            : (callback) =>
                exclusive(async () => {
                  const db = getDatabase();
                  db.exec("BEGIN IMMEDIATE");
                  try {
                    const result = await callback(build(true));
                    db.exec("COMMIT");
                    return result;
                  } catch (error) {
                    db.exec("ROLLBACK");
                    throw error;
                  }
                }),
        },
        adapter: () => ({
          create: ({ model, data }) =>
            run((db) => {
              const entries = Object.entries(data).filter(([, value]) => value !== undefined);
              return db
                .query(
                  `INSERT INTO ${identifier(model)} (${entries.map(([key]) => identifier(key)).join(", ")}) VALUES (${entries.map(() => "?").join(", ")}) RETURNING *`,
                )
                .get(...entries.map(([, value]) => binding(value))) as typeof data;
            }),
          findOne: <T>({ model, where }: { model: string; where: CleanedWhere[] }) =>
            run((db) => {
              const filter = conditions(where);
              return db
                .query(`SELECT * FROM ${identifier(model)}${filter.sql} LIMIT 1`)
                .get(...filter.values) as T | null;
            }),
          findMany: <T>({
            model,
            where,
            limit,
            offset,
            sortBy,
          }: Parameters<CustomAdapter["findMany"]>[0]) =>
            run((db) => {
              const filter = conditions(where);
              const order = sortBy
                ? ` ORDER BY ${identifier(sortBy.field)} ${sortBy.direction === "desc" ? "DESC" : "ASC"}`
                : "";
              return db
                .query(`SELECT * FROM ${identifier(model)}${filter.sql}${order} LIMIT ? OFFSET ?`)
                .all(...filter.values, limit, offset ?? 0) as T[];
            }),
          count: ({ model, where }) =>
            run((db) => {
              const filter = conditions(where);
              return db
                .query<{ count: number }, SQLQueryBindings[]>(
                  `SELECT COUNT(*) AS count FROM ${identifier(model)}${filter.sql}`,
                )
                .get(...filter.values)!.count;
            }),
          update: <T>({
            model,
            where,
            update,
          }: {
            model: string;
            where: CleanedWhere[];
            update: T;
          }) =>
            run((db) => {
              if (!where.length) return null;
              const filter = conditions(where);
              const changes = assignments(update as object);
              const table = identifier(model);
              if (!changes.sql)
                return db
                  .query(`SELECT * FROM ${table}${filter.sql} LIMIT 1`)
                  .get(...filter.values) as T | null;
              return db
                .query(
                  `UPDATE ${table} SET ${changes.sql} WHERE id = (SELECT id FROM ${table}${filter.sql} LIMIT 1) RETURNING *`,
                )
                .get(...changes.values, ...filter.values) as T | null;
            }),
          updateMany: ({ model, where, update }) =>
            run((db) => {
              const filter = conditions(where);
              const changes = assignments(update);
              if (!changes.sql) return 0;
              return db
                .query(`UPDATE ${identifier(model)} SET ${changes.sql}${filter.sql}`)
                .run(...changes.values, ...filter.values).changes;
            }),
          delete: ({ model, where }) =>
            run((db) => {
              if (!where.length) return;
              const filter = conditions(where);
              const table = identifier(model);
              db.query(
                `DELETE FROM ${table} WHERE id = (SELECT id FROM ${table}${filter.sql} LIMIT 1)`,
              ).run(...filter.values);
            }),
          deleteMany: ({ model, where }) =>
            run((db) => {
              const filter = conditions(where);
              return db.query(`DELETE FROM ${identifier(model)}${filter.sql}`).run(...filter.values)
                .changes;
            }),
        }),
      })(options);
    };
    return build(false);
  };
}
