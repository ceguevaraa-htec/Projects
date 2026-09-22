import { Migrator, type Kysely } from "kysely";
import type { Database } from "./schema.js";
import { migrationProvider } from "./migrations/index.js";

/** Applies all pending migrations to `db`, in order, up to the latest. */
export async function migrateToLatest(db: Kysely<Database>): Promise<void> {
  const migrator = new Migrator({
    db: db as unknown as Kysely<unknown>,
    provider: migrationProvider,
  });
  const { error, results } = await migrator.migrateToLatest();

  for (const result of results ?? []) {
    if (result.status === "Error") {
      throw new Error(`Migration "${result.migrationName}" failed`);
    }
  }

  if (error) {
    throw error;
  }
}
