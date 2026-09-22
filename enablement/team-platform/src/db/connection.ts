import Database from "better-sqlite3";
import { Kysely, SqliteDialect } from "kysely";
import type { Database as Schema } from "./schema.js";

const BUSY_TIMEOUT_MS = 5000;

/**
 * Creates a Kysely instance over a SQLite file at `path`.
 * Busy-timeout is configured per SDP NFR-0006: a resilience safeguard for rare
 * near-simultaneous local requests, not a concurrent-multi-user architecture.
 */
export function createDb(path: string): Kysely<Schema> {
  const sqlite = new Database(path);
  sqlite.pragma(`busy_timeout = ${BUSY_TIMEOUT_MS}`);
  sqlite.pragma("foreign_keys = ON");

  return new Kysely<Schema>({
    dialect: new SqliteDialect({ database: sqlite }),
  });
}
