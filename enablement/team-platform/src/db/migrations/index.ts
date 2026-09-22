import type { Migration, MigrationProvider } from "kysely";
import * as m0001 from "./0001_employee_management.js";
import * as m0002 from "./0002_project_management.js";
import * as m0003 from "./0003_assignment_engine.js";

const migrations: Record<string, Migration> = {
  "0001_employee_management": m0001,
  "0002_project_management": m0002,
  "0003_assignment_engine": m0003,
};

/** In-code migration registry — avoids filesystem globbing for a small, solo-scale project. */
export const migrationProvider: MigrationProvider = {
  async getMigrations() {
    return migrations;
  },
};
