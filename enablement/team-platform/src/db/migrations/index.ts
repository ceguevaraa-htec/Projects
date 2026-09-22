import type { Migration, MigrationProvider } from "kysely";
import * as m0001 from "./0001_employee_management.js";

const migrations: Record<string, Migration> = {
  "0001_employee_management": m0001,
};

/** In-code migration registry — avoids filesystem globbing for a small, solo-scale project. */
export const migrationProvider: MigrationProvider = {
  async getMigrations() {
    return migrations;
  },
};
