import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Kysely } from "kysely";
import { createDb } from "../../src/db/connection.js";
import { migrateToLatest } from "../../src/db/migrate.js";
import type { Database } from "../../src/db/schema.js";

export interface TestDb {
  db: Kysely<Database>;
  cleanup: () => Promise<void>;
}

/** Creates a fresh, freshly-migrated temp-file SQLite database for one test file (NFR-0002). */
export async function createTestDb(): Promise<TestDb> {
  const dir = mkdtempSync(join(tmpdir(), "team-allocation-test-"));
  const path = join(dir, "test.db");
  const db = createDb(path);
  await migrateToLatest(db);

  return {
    db,
    cleanup: async () => {
      await db.destroy();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
