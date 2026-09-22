import { randomUUID } from "node:crypto";
import type { Kysely } from "kysely";
import type { Database } from "../db/schema.js";
import type { EmployeeSkillRecord, Proficiency, SkillRecord } from "../domain/types.js";

/**
 * Kysely queries only — no business rules. Owns both the `skills` catalog table and the
 * `employee_skills` association table: co-located here (rather than a separate
 * employee-skill.repository.ts) because deletion-impact counting and cascading delete already
 * require this repository to query `employee_skills`, so splitting association CRUD into a
 * second file would duplicate that table's query surface for no benefit.
 */
export interface SkillRepository {
  insert(name: string): Promise<SkillRecord>;
  update(skillId: string, name: string): Promise<SkillRecord | undefined>;
  findById(skillId: string): Promise<SkillRecord | undefined>;
  findAll(): Promise<SkillRecord[]>;
  findByName(name: string): Promise<SkillRecord | undefined>;
  delete(skillId: string): Promise<void>;
  countEmployeeAssociations(skillId: string): Promise<number>;
  /**
   * Interim EPIC-0001-only stub: the project-role required-skills table does not exist until
   * EPIC-0002 (Project Management), so this always returns 0. MUST become a real query once
   * that table exists — see data-model.md's flagged cross-epic follow-up and tasks.md T043.
   */
  countProjectRoleAssociations(skillId: string): Promise<number>;

  findEmployeeSkill(employeeId: string, skillId: string): Promise<EmployeeSkillRecord | undefined>;
  findSkillsForEmployee(employeeId: string): Promise<EmployeeSkillRecord[]>;
  insertEmployeeSkill(
    employeeId: string,
    skillId: string,
    proficiency: Proficiency,
  ): Promise<EmployeeSkillRecord>;
  updateEmployeeSkillProficiency(
    employeeId: string,
    skillId: string,
    proficiency: Proficiency,
  ): Promise<EmployeeSkillRecord>;
  deleteEmployeeSkill(employeeId: string, skillId: string): Promise<void>;
}

function toSkillRecord(row: { id: string; name: string }): SkillRecord {
  return { skillId: row.id, name: row.name };
}

export class KyselySkillRepository implements SkillRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async insert(name: string): Promise<SkillRecord> {
    const row = await this.db
      .insertInto("skills")
      .values({ id: randomUUID(), name })
      .returningAll()
      .executeTakeFirstOrThrow();
    return toSkillRecord(row);
  }

  async update(skillId: string, name: string): Promise<SkillRecord | undefined> {
    const row = await this.db
      .updateTable("skills")
      .set({ name })
      .where("id", "=", skillId)
      .returningAll()
      .executeTakeFirst();
    return row ? toSkillRecord(row) : undefined;
  }

  async findById(skillId: string): Promise<SkillRecord | undefined> {
    const row = await this.db
      .selectFrom("skills")
      .selectAll()
      .where("id", "=", skillId)
      .executeTakeFirst();
    return row ? toSkillRecord(row) : undefined;
  }

  async findAll(): Promise<SkillRecord[]> {
    const rows = await this.db.selectFrom("skills").selectAll().orderBy("name", "asc").execute();
    return rows.map(toSkillRecord);
  }

  async findByName(name: string): Promise<SkillRecord | undefined> {
    // The `name` column is COLLATE NOCASE (see migration 0001), so this comparison is
    // case-insensitive by construction.
    const row = await this.db
      .selectFrom("skills")
      .selectAll()
      .where("name", "=", name)
      .executeTakeFirst();
    return row ? toSkillRecord(row) : undefined;
  }

  async delete(skillId: string): Promise<void> {
    // employee_skills rows cascade via the FK ON DELETE CASCADE defined in migration 0001.
    await this.db.deleteFrom("skills").where("id", "=", skillId).execute();
  }

  async countEmployeeAssociations(skillId: string): Promise<number> {
    const result = await this.db
      .selectFrom("employee_skills")
      .select(({ fn }) => fn.countAll<number>().as("count"))
      .where("skill_id", "=", skillId)
      .executeTakeFirstOrThrow();
    return Number(result.count);
  }

  async countProjectRoleAssociations(_skillId: string): Promise<number> {
    return 0;
  }

  async findEmployeeSkill(
    employeeId: string,
    skillId: string,
  ): Promise<EmployeeSkillRecord | undefined> {
    const row = await this.db
      .selectFrom("employee_skills")
      .innerJoin("skills", "skills.id", "employee_skills.skill_id")
      .select([
        "employee_skills.skill_id",
        "skills.name as skill_name",
        "employee_skills.proficiency",
      ])
      .where("employee_skills.employee_id", "=", employeeId)
      .where("employee_skills.skill_id", "=", skillId)
      .executeTakeFirst();

    if (!row) return undefined;
    return { skillId: row.skill_id, skillName: row.skill_name, proficiency: row.proficiency };
  }

  async findSkillsForEmployee(employeeId: string): Promise<EmployeeSkillRecord[]> {
    const rows = await this.db
      .selectFrom("employee_skills")
      .innerJoin("skills", "skills.id", "employee_skills.skill_id")
      .select([
        "employee_skills.skill_id",
        "skills.name as skill_name",
        "employee_skills.proficiency",
      ])
      .where("employee_skills.employee_id", "=", employeeId)
      .orderBy("skills.name", "asc")
      .execute();

    return rows.map((row) => ({
      skillId: row.skill_id,
      skillName: row.skill_name,
      proficiency: row.proficiency,
    }));
  }

  async insertEmployeeSkill(
    employeeId: string,
    skillId: string,
    proficiency: Proficiency,
  ): Promise<EmployeeSkillRecord> {
    await this.db
      .insertInto("employee_skills")
      .values({ employee_id: employeeId, skill_id: skillId, proficiency })
      .execute();

    const association = await this.findEmployeeSkill(employeeId, skillId);
    if (!association) {
      throw new Error("Failed to read back inserted employee_skill association.");
    }
    return association;
  }

  async updateEmployeeSkillProficiency(
    employeeId: string,
    skillId: string,
    proficiency: Proficiency,
  ): Promise<EmployeeSkillRecord> {
    await this.db
      .updateTable("employee_skills")
      .set({ proficiency })
      .where("employee_id", "=", employeeId)
      .where("skill_id", "=", skillId)
      .execute();

    const association = await this.findEmployeeSkill(employeeId, skillId);
    if (!association) {
      throw new Error("Failed to read back updated employee_skill association.");
    }
    return association;
  }

  async deleteEmployeeSkill(employeeId: string, skillId: string): Promise<void> {
    await this.db
      .deleteFrom("employee_skills")
      .where("employee_id", "=", employeeId)
      .where("skill_id", "=", skillId)
      .execute();
  }
}
