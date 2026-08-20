/**
 * A tiny SQLite driver built on Node's built-in `node:sqlite` module.
 *
 * Why this exists: the app used to depend on `better-sqlite3`, a *native*
 * package that has to be compiled (or matched to a prebuilt binary) on the
 * machine that installs it. On a plain office PC without Visual Studio Build
 * Tools / Python that install step is what breaks `npm install`, and with it
 * `npm run dev`.
 *
 * `node:sqlite` ships inside Node.js itself — nothing to compile, nothing
 * extra to download, no toolchain. This module wraps it in the small slice of
 * the better-sqlite3 API the rest of the app already uses (`prepare`, `exec`,
 * `transaction`, `pragma`), so no call site had to change.
 */
import type { DatabaseSync as DatabaseSyncClass, StatementSync } from "node:sqlite";

/**
 * `node:sqlite` is reached through `process.getBuiltinModule` rather than a
 * plain `import`. A bundler treats a `node:` import as an "external" and wires
 * it up with `require`, which is not defined in the ESM chunks Next.js emits —
 * that surfaces as "Failed to load external module node:sqlite" the first time
 * a file is hot-reloaded. `getBuiltinModule` is a direct handle on Node's own
 * module, invisible to the bundler, so it works in dev and in production alike.
 * The `import type` above is erased at compile time and costs nothing.
 */
const { DatabaseSync } = process.getBuiltinModule("node:sqlite");
type DatabaseSync = DatabaseSyncClass;

/** A prepared statement. Values may be passed positionally (`?`) or as a
 *  single object for named placeholders (`@name`), exactly as before. */
export interface Statement {
  run(...params: unknown[]): { changes: number; lastInsertRowid: number };
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}

/**
 * `node:sqlite` hands back rows with a null prototype. That is fine for
 * property reads, but it trips up anything that expects an ordinary object
 * (spreading into React props, `Object.prototype` helpers, some libraries).
 * Copying into a plain object once, here, keeps every call site normal.
 */
function toPlainRow(row: unknown): unknown {
  if (row === undefined || row === null || typeof row !== "object") return row;
  return { ...(row as Record<string, unknown>) };
}

function toNumber(value: number | bigint | undefined): number {
  return typeof value === "bigint" ? Number(value) : (value ?? 0);
}

/** Matches `@name`, `:name` and `$name` placeholders. */
const NAMED_PARAM = /[@:$]([A-Za-z_][A-Za-z0-9_]*)/g;

/**
 * The named placeholders a statement actually uses.
 *
 * Call sites here follow a common pattern: read a whole row, spread a patch
 * over it, and hand the merged object to an UPDATE that only touches some of
 * the columns. better-sqlite3 ignored the leftover keys; `node:sqlite` rejects
 * them outright ("Unknown named parameter"). Knowing the real parameter names
 * lets us bind only those and keep the old, forgiving behaviour.
 *
 * String literals and comments are blanked first so an `@` or `:` inside them
 * (a time like '10:30', say) is never mistaken for a placeholder.
 */
function namedParametersOf(sql: string): Set<string> {
  const code = sql
    .replace(/--[^\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/'(?:[^']|'')*'/g, " '' ")
    .replace(/"(?:[^"]|"")*"/g, ' "" ');
  const names = new Set<string>();
  for (const match of code.matchAll(NAMED_PARAM)) names.add(match[1]);
  return names;
}

/** True for a bind object (`{ id: ... }`) rather than a positional value. */
function isBindObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !ArrayBuffer.isView(value) &&
    !(value instanceof Date)
  );
}

export class SqliteDatabase {
  private readonly db: DatabaseSync;
  /** Prepared statements are cached: the app prepares the same SQL on every
   *  request, and re-preparing is pure overhead. */
  private readonly cache = new Map<string, StatementSync>();
  /** Named placeholders per SQL string, worked out once on first use. */
  private readonly paramNames = new Map<string, Set<string>>();
  /** Depth of nested `transaction()` calls, so an inner transaction joins the
   *  outer one (via SAVEPOINT) instead of trying to BEGIN twice. */
  private depth = 0;

  constructor(filename: string) {
    this.db = new DatabaseSync(filename);
  }

  private compile(sql: string): StatementSync {
    let stmt = this.cache.get(sql);
    if (!stmt) {
      stmt = this.db.prepare(sql);
      this.cache.set(sql, stmt);
    }
    return stmt;
  }

  /** Drops keys the statement has no placeholder for; leaves anything else alone. */
  private bind(sql: string, params: unknown[]): unknown[] {
    if (params.length !== 1 || !isBindObject(params[0])) return params;

    let names = this.paramNames.get(sql);
    if (!names) {
      names = namedParametersOf(sql);
      this.paramNames.set(sql, names);
    }

    const source = params[0];
    const bound: Record<string, unknown> = {};
    for (const name of names) {
      if (name in source) bound[name] = source[name];
    }
    return [bound];
  }

  /** Runs one or more statements. Used for DDL and multi-statement scripts. */
  exec(sql: string): void {
    this.db.exec(sql);
  }

  /** `db.pragma("journal_mode = WAL")` — kept for readability at call sites. */
  pragma(statement: string): void {
    this.db.exec(`PRAGMA ${statement}`);
  }

  prepare(sql: string): Statement {
    return {
      run: (...params: unknown[]) => {
        const result = this.compile(sql).run(...(this.bind(sql, params) as never[]));
        return {
          changes: toNumber(result.changes),
          lastInsertRowid: toNumber(result.lastInsertRowid),
        };
      },
      get: (...params: unknown[]) =>
        toPlainRow(this.compile(sql).get(...(this.bind(sql, params) as never[]))),
      all: (...params: unknown[]) =>
        this.compile(sql).all(...(this.bind(sql, params) as never[])).map(toPlainRow),
    };
  }

  /**
   * Wraps `fn` so every statement inside it commits together or not at all.
   * Mirrors better-sqlite3's `transaction()`: it returns a function, and the
   * arguments you call that function with are forwarded to `fn`.
   */
  transaction<Args extends unknown[], Result>(
    fn: (...args: Args) => Result
  ): (...args: Args) => Result {
    return (...args: Args): Result => {
      const nested = this.depth > 0;
      const savepoint = `sp_${this.depth}`;
      this.db.exec(nested ? `SAVEPOINT ${savepoint}` : "BEGIN");
      this.depth++;
      try {
        const result = fn(...args);
        this.depth--;
        this.db.exec(nested ? `RELEASE ${savepoint}` : "COMMIT");
        return result;
      } catch (err) {
        this.depth--;
        try {
          this.db.exec(nested ? `ROLLBACK TO ${savepoint}` : "ROLLBACK");
          if (nested) this.db.exec(`RELEASE ${savepoint}`);
        } catch {
          // The rollback itself failing (e.g. the connection is gone) must not
          // mask the original error, which is the one worth reporting.
        }
        throw err;
      }
    };
  }

  close(): void {
    this.cache.clear();
    this.db.close();
  }
}
