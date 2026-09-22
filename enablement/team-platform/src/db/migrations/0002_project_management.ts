import type { Kysely } from "kysely";

/**
 * Creates the projects, project_roles, and project_role_skills tables for EPIC-0002.
 * Field shapes mirror specs/002-project-management/data-model.md exactly.
 * project_role_skills references the existing skills table from migration 0001
 * (EPIC-0001) — no new skill-related table is created here.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("projects")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("start_date", "text", (col) => col.notNull())
    .addColumn("end_date", "text", (col) => col.notNull())
    .addColumn("status", "text", (col) => col.notNull().defaultTo("Draft"))
    .execute();

  await db.schema
    .createTable("project_roles")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("project_id", "text", (col) =>
      col.notNull().references("projects.id").onDelete("cascade"),
    )
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("capacity_percent", "integer", (col) => col.notNull())
    .execute();

  await db.schema
    .createTable("project_role_skills")
    .addColumn("project_role_id", "text", (col) =>
      col.notNull().references("project_roles.id").onDelete("cascade"),
    )
    .addColumn("skill_id", "text", (col) =>
      col.notNull().references("skills.id").onDelete("cascade"),
    )
    .addPrimaryKeyConstraint("project_role_skills_pk", ["project_role_id", "skill_id"])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("project_role_skills").execute();
  await db.schema.dropTable("project_roles").execute();
  await db.schema.dropTable("projects").execute();
}
