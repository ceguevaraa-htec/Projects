import type { Kysely } from "kysely";

/**
 * Creates the assignments table for EPIC-0003. Field shapes mirror
 * specs/003-assignment-engine/data-model.md exactly.
 *
 * employee_id/project_role_id use ON DELETE RESTRICT (not CASCADE, unlike every other FK in
 * this schema so far) — an assignment is the historical record FR-0003/FR-0011/FR-0012 exist
 * to protect, so it must never be silently destroyed by deleting its parent. Domain Logic's
 * explicit hasAnyAssignments/roleHasAnyAssignments checks are the primary enforcement; this FK
 * is a structural safety net underneath them. See research.md.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("assignments")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("employee_id", "text", (col) =>
      col.notNull().references("employees.id").onDelete("restrict"),
    )
    .addColumn("project_id", "text", (col) =>
      col.notNull().references("projects.id").onDelete("restrict"),
    )
    .addColumn("project_role_id", "text", (col) =>
      col.notNull().references("project_roles.id").onDelete("restrict"),
    )
    .addColumn("capacity_percent", "integer", (col) => col.notNull())
    .addColumn("start_date", "text", (col) => col.notNull())
    .addColumn("end_date", "text", (col) => col.notNull())
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("assignments").execute();
}
