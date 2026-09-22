import { sql, type Kysely } from "kysely";

/**
 * Creates the employees, skills, and employee_skills tables for EPIC-0001.
 * Field shapes mirror specs/001-employee-management/data-model.md exactly.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("employees")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("employment_start_date", "text", (col) => col.notNull())
    .addColumn("employment_end_date", "text")
    .addColumn("seniority", "text", (col) => col.notNull())
    .execute();

  // `name` uses COLLATE NOCASE so both equality lookups and the unique index below are
  // case-insensitive by construction, satisfying the "case-sensitivity aside" edge case
  // for FR-0006/FR-0007 without relying on application-level normalization alone.
  await db.schema
    .createTable("skills")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("name", sql`text collate nocase`, (col) => col.notNull())
    .execute();

  await db.schema
    .createIndex("skills_name_unique_nocase")
    .on("skills")
    .column("name")
    .unique()
    .execute();

  await db.schema
    .createTable("employee_skills")
    .addColumn("employee_id", "text", (col) =>
      col.notNull().references("employees.id").onDelete("cascade"),
    )
    .addColumn("skill_id", "text", (col) =>
      col.notNull().references("skills.id").onDelete("cascade"),
    )
    .addColumn("proficiency", "text", (col) => col.notNull())
    .addColumn("created_at", "text", (col) => col.notNull().defaultTo("CURRENT_TIMESTAMP"))
    .addPrimaryKeyConstraint("employee_skills_pk", ["employee_id", "skill_id"])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("employee_skills").execute();
  await db.schema.dropTable("skills").execute();
  await db.schema.dropTable("employees").execute();
}
