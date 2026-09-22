import { randomUUID } from "node:crypto";
import type { Kysely } from "kysely";
import type { Database } from "../db/schema.js";
import type {
  ProjectCreateInput,
  ProjectListFilters,
  ProjectRecord,
  ProjectRoleCreateInput,
  ProjectRoleRecord,
  ProjectRoleUpdateInput,
  ProjectUpdateInput,
} from "../domain/types.js";

/**
 * Kysely queries only — no business rules. Owns both the `projects` table and the
 * `project_roles`/`project_role_skills` tables, mirroring skill.repository.ts's co-location of
 * skills and employee_skills: role queries are inseparable from their parent project's table
 * surface (embedding, cascading delete), so splitting them into a second file would duplicate
 * that surface for no benefit.
 */
export interface ProjectRepository {
  insert(input: ProjectCreateInput): Promise<ProjectRecord>;
  update(projectId: string, input: ProjectUpdateInput): Promise<ProjectRecord | undefined>;
  findById(projectId: string): Promise<ProjectRecord | undefined>;
  findAll(filters: ProjectListFilters): Promise<ProjectRecord[]>;
  delete(projectId: string): Promise<void>;
  /**
   * Real existence query as of EPIC-0003 (see specs/002-project-management/data-model.md,
   * now resolved, and specs/003-assignment-engine/tasks.md T039).
   */
  hasAnyAssignments(projectId: string): Promise<boolean>;

  insertRole(projectId: string, input: ProjectRoleCreateInput): Promise<ProjectRoleRecord>;
  updateRole(roleId: string, input: ProjectRoleUpdateInput): Promise<ProjectRoleRecord | undefined>;
  deleteRole(roleId: string): Promise<void>;
  findRoleById(roleId: string): Promise<ProjectRoleRecord | undefined>;
  findRolesForProject(projectId: string): Promise<ProjectRoleRecord[]>;
  /**
   * Real existence query as of EPIC-0003 (see specs/002-project-management/data-model.md,
   * now resolved, and specs/003-assignment-engine/tasks.md T040).
   */
  roleHasAnyAssignments(roleId: string): Promise<boolean>;
}

function toProjectRecord(row: {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
}): ProjectRecord {
  return {
    projectId: row.id,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status as ProjectRecord["status"],
  };
}

export class KyselyProjectRepository implements ProjectRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async insert(input: ProjectCreateInput): Promise<ProjectRecord> {
    const row = await this.db
      .insertInto("projects")
      .values({
        id: randomUUID(),
        name: input.name,
        start_date: input.startDate,
        end_date: input.endDate,
        status: "Draft",
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return toProjectRecord(row);
  }

  async update(projectId: string, input: ProjectUpdateInput): Promise<ProjectRecord | undefined> {
    const updates: Record<string, unknown> = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.startDate !== undefined) updates.start_date = input.startDate;
    if (input.endDate !== undefined) updates.end_date = input.endDate;
    if (input.status !== undefined) updates.status = input.status;

    if (Object.keys(updates).length === 0) {
      return this.findById(projectId);
    }

    const row = await this.db
      .updateTable("projects")
      .set(updates)
      .where("id", "=", projectId)
      .returningAll()
      .executeTakeFirst();

    return row ? toProjectRecord(row) : undefined;
  }

  async findById(projectId: string): Promise<ProjectRecord | undefined> {
    const row = await this.db
      .selectFrom("projects")
      .selectAll()
      .where("id", "=", projectId)
      .executeTakeFirst();

    return row ? toProjectRecord(row) : undefined;
  }

  async findAll(filters: ProjectListFilters): Promise<ProjectRecord[]> {
    let query = this.db.selectFrom("projects").selectAll();

    if (filters.status) {
      query = query.where("status", "=", filters.status);
    }
    if (filters.startDateFrom) {
      query = query.where("start_date", ">=", filters.startDateFrom);
    }
    if (filters.startDateTo) {
      query = query.where("start_date", "<=", filters.startDateTo);
    }
    if (filters.requiredRole) {
      const roleQuery = this.db
        .selectFrom("project_roles")
        .select("project_id")
        .where("name", "=", filters.requiredRole);
      query = query.where("id", "in", roleQuery);
    }

    const sortColumn =
      filters.sort === "startDate"
        ? "start_date"
        : filters.sort === "endDate"
          ? "end_date"
          : "name";
    query = query.orderBy(sortColumn, filters.order ?? "asc");

    const rows = await query.execute();
    return rows.map(toProjectRecord);
  }

  async delete(projectId: string): Promise<void> {
    await this.db.deleteFrom("projects").where("id", "=", projectId).execute();
  }

  async hasAnyAssignments(projectId: string): Promise<boolean> {
    // assignments.project_id is a stored column (not derived), per data-model.md — no join
    // through project_roles is needed here.
    const row = await this.db
      .selectFrom("assignments")
      .select("id")
      .where("project_id", "=", projectId)
      .executeTakeFirst();
    return row !== undefined;
  }

  private async hydrateRole(roleRow: {
    id: string;
    project_id: string;
    name: string;
    capacity_percent: number;
  }): Promise<ProjectRoleRecord> {
    const skillRows = await this.db
      .selectFrom("project_role_skills")
      .innerJoin("skills", "skills.id", "project_role_skills.skill_id")
      .select(["skills.id", "skills.name"])
      .where("project_role_skills.project_role_id", "=", roleRow.id)
      .execute();

    return {
      roleId: roleRow.id,
      projectId: roleRow.project_id,
      name: roleRow.name,
      capacityPercent: roleRow.capacity_percent,
      requiredSkills: skillRows.map((s) => ({ skillId: s.id, name: s.name })),
    };
  }

  async insertRole(projectId: string, input: ProjectRoleCreateInput): Promise<ProjectRoleRecord> {
    const roleId = randomUUID();
    const row = await this.db
      .insertInto("project_roles")
      .values({
        id: roleId,
        project_id: projectId,
        name: input.name,
        capacity_percent: input.capacityPercent,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    if (input.requiredSkillIds && input.requiredSkillIds.length > 0) {
      await this.db
        .insertInto("project_role_skills")
        .values(
          input.requiredSkillIds.map((skillId) => ({ project_role_id: roleId, skill_id: skillId })),
        )
        .execute();
    }

    return this.hydrateRole(row);
  }

  async updateRole(
    roleId: string,
    input: ProjectRoleUpdateInput,
  ): Promise<ProjectRoleRecord | undefined> {
    const updates: Record<string, unknown> = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.capacityPercent !== undefined) updates.capacity_percent = input.capacityPercent;

    if (Object.keys(updates).length > 0) {
      await this.db.updateTable("project_roles").set(updates).where("id", "=", roleId).execute();
    }

    if (input.requiredSkillIds !== undefined) {
      await this.db
        .deleteFrom("project_role_skills")
        .where("project_role_id", "=", roleId)
        .execute();
      if (input.requiredSkillIds.length > 0) {
        await this.db
          .insertInto("project_role_skills")
          .values(
            input.requiredSkillIds.map((skillId) => ({
              project_role_id: roleId,
              skill_id: skillId,
            })),
          )
          .execute();
      }
    }

    return this.findRoleById(roleId);
  }

  async deleteRole(roleId: string): Promise<void> {
    // project_role_skills rows cascade via the FK ON DELETE CASCADE defined in migration 0002.
    await this.db.deleteFrom("project_roles").where("id", "=", roleId).execute();
  }

  async findRoleById(roleId: string): Promise<ProjectRoleRecord | undefined> {
    const row = await this.db
      .selectFrom("project_roles")
      .selectAll()
      .where("id", "=", roleId)
      .executeTakeFirst();

    return row ? this.hydrateRole(row) : undefined;
  }

  async findRolesForProject(projectId: string): Promise<ProjectRoleRecord[]> {
    const rows = await this.db
      .selectFrom("project_roles")
      .selectAll()
      .where("project_id", "=", projectId)
      .orderBy("name", "asc")
      .execute();

    return Promise.all(rows.map((row) => this.hydrateRole(row)));
  }

  async roleHasAnyAssignments(roleId: string): Promise<boolean> {
    const row = await this.db
      .selectFrom("assignments")
      .select("id")
      .where("project_role_id", "=", roleId)
      .executeTakeFirst();
    return row !== undefined;
  }
}
