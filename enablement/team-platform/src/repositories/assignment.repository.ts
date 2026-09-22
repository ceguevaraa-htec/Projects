import { randomUUID } from "node:crypto";
import type { Kysely } from "kysely";
import type { Database } from "../db/schema.js";
import { includesToday, isInFuture } from "../domain/date-utils.js";
import type {
  AssignmentCreateInput,
  AssignmentRecord,
  AssignmentUpdateInput,
} from "../domain/types.js";

/** Kysely queries only — no business rules. See src/domain/assignment.service.ts for rules. */
export interface AssignmentRepository {
  insert(input: AssignmentCreateInput): Promise<AssignmentRecord>;
  update(assignmentId: string, input: AssignmentUpdateInput): Promise<AssignmentRecord | undefined>;
  findById(assignmentId: string): Promise<AssignmentRecord | undefined>;
  findAllForEmployee(employeeId: string): Promise<AssignmentRecord[]>;
  /** Unfiltered (past/current/future) — see specs/004-bench-reporting/data-model.md for why current-only scoping is a Domain Logic decision, not a repository-level restriction. */
  findAllForProject(projectId: string): Promise<AssignmentRecord[]>;
  delete(assignmentId: string): Promise<void>;
}

interface JoinedRow {
  id: string;
  employee_id: string;
  employee_name: string;
  project_id: string;
  project_name: string;
  project_role_id: string;
  role_name: string;
  capacity_percent: number;
  start_date: string;
  end_date: string;
}

function toRecord(row: JoinedRow): AssignmentRecord {
  let temporalStatus: AssignmentRecord["temporalStatus"];
  if (isInFuture(row.start_date)) {
    temporalStatus = "future";
  } else if (includesToday({ start: row.start_date, end: row.end_date })) {
    temporalStatus = "current";
  } else {
    temporalStatus = "past";
  }

  return {
    assignmentId: row.id,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    projectId: row.project_id,
    projectName: row.project_name,
    roleId: row.project_role_id,
    roleName: row.role_name,
    capacityPercent: row.capacity_percent,
    startDate: row.start_date,
    endDate: row.end_date,
    temporalStatus,
  };
}

export class KyselyAssignmentRepository implements AssignmentRepository {
  constructor(private readonly db: Kysely<Database>) {}

  private joinedQuery() {
    return this.db
      .selectFrom("assignments")
      .innerJoin("employees", "employees.id", "assignments.employee_id")
      .innerJoin("projects", "projects.id", "assignments.project_id")
      .innerJoin("project_roles", "project_roles.id", "assignments.project_role_id")
      .select([
        "assignments.id",
        "assignments.employee_id",
        "employees.name as employee_name",
        "assignments.project_id",
        "projects.name as project_name",
        "assignments.project_role_id",
        "project_roles.name as role_name",
        "assignments.capacity_percent",
        "assignments.start_date",
        "assignments.end_date",
      ]);
  }

  async insert(input: AssignmentCreateInput): Promise<AssignmentRecord> {
    const id = randomUUID();
    await this.db
      .insertInto("assignments")
      .values({
        id,
        employee_id: input.employeeId,
        project_id: input.projectId,
        project_role_id: input.roleId,
        capacity_percent: input.capacityPercent,
        start_date: input.startDate,
        end_date: input.endDate,
      })
      .execute();

    const record = await this.findById(id);
    if (!record) {
      throw new Error("Failed to read back inserted assignment.");
    }
    return record;
  }

  async update(
    assignmentId: string,
    input: AssignmentUpdateInput,
  ): Promise<AssignmentRecord | undefined> {
    const updates: Record<string, unknown> = {};
    if (input.roleId !== undefined) updates.project_role_id = input.roleId;
    if (input.capacityPercent !== undefined) updates.capacity_percent = input.capacityPercent;
    if (input.startDate !== undefined) updates.start_date = input.startDate;
    if (input.endDate !== undefined) updates.end_date = input.endDate;

    if (Object.keys(updates).length > 0) {
      await this.db
        .updateTable("assignments")
        .set(updates)
        .where("id", "=", assignmentId)
        .execute();
    }

    return this.findById(assignmentId);
  }

  async findById(assignmentId: string): Promise<AssignmentRecord | undefined> {
    const row = await this.joinedQuery()
      .where("assignments.id", "=", assignmentId)
      .executeTakeFirst();
    return row ? toRecord(row) : undefined;
  }

  async findAllForEmployee(employeeId: string): Promise<AssignmentRecord[]> {
    const rows = await this.joinedQuery()
      .where("assignments.employee_id", "=", employeeId)
      .execute();
    return rows.map(toRecord);
  }

  async findAllForProject(projectId: string): Promise<AssignmentRecord[]> {
    const rows = await this.joinedQuery().where("assignments.project_id", "=", projectId).execute();
    return rows.map(toRecord);
  }

  async delete(assignmentId: string): Promise<void> {
    await this.db.deleteFrom("assignments").where("id", "=", assignmentId).execute();
  }
}
