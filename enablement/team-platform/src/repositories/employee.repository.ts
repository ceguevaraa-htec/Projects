import { randomUUID } from "node:crypto";
import type { Kysely } from "kysely";
import type { Database } from "../db/schema.js";
import type {
  EmployeeCreateInput,
  EmployeeListFilters,
  EmployeeRecord,
  EmployeeUpdateInput,
} from "../domain/types.js";

/** Kysely queries only — no business rules. See src/domain/employee.service.ts for rules. */
export interface EmployeeRepository {
  insert(input: EmployeeCreateInput): Promise<EmployeeRecord>;
  update(employeeId: string, input: EmployeeUpdateInput): Promise<EmployeeRecord | undefined>;
  findById(employeeId: string): Promise<EmployeeRecord | undefined>;
  findAll(filters: EmployeeListFilters): Promise<EmployeeRecord[]>;
  delete(employeeId: string): Promise<void>;
  /**
   * Real existence query as of EPIC-0003 (see specs/001-employee-management/data-model.md,
   * now resolved, and specs/003-assignment-engine/tasks.md T036).
   */
  hasAnyAssignments(employeeId: string): Promise<boolean>;
}

function toRecord(row: {
  id: string;
  name: string;
  employment_start_date: string;
  employment_end_date: string | null;
  seniority: string;
}): EmployeeRecord {
  return {
    employeeId: row.id,
    name: row.name,
    employmentStartDate: row.employment_start_date,
    employmentEndDate: row.employment_end_date,
    seniority: row.seniority as EmployeeRecord["seniority"],
  };
}

export class KyselyEmployeeRepository implements EmployeeRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async insert(input: EmployeeCreateInput): Promise<EmployeeRecord> {
    const row = await this.db
      .insertInto("employees")
      .values({
        id: randomUUID(),
        name: input.name,
        employment_start_date: input.employmentStartDate,
        employment_end_date: input.employmentEndDate ?? null,
        seniority: input.seniority,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return toRecord(row);
  }

  async update(
    employeeId: string,
    input: EmployeeUpdateInput,
  ): Promise<EmployeeRecord | undefined> {
    const updates: Record<string, unknown> = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.employmentStartDate !== undefined)
      updates.employment_start_date = input.employmentStartDate;
    if (input.employmentEndDate !== undefined)
      updates.employment_end_date = input.employmentEndDate;
    if (input.seniority !== undefined) updates.seniority = input.seniority;

    if (Object.keys(updates).length === 0) {
      return this.findById(employeeId);
    }

    const row = await this.db
      .updateTable("employees")
      .set(updates)
      .where("id", "=", employeeId)
      .returningAll()
      .executeTakeFirst();

    return row ? toRecord(row) : undefined;
  }

  async findById(employeeId: string): Promise<EmployeeRecord | undefined> {
    const row = await this.db
      .selectFrom("employees")
      .selectAll()
      .where("id", "=", employeeId)
      .executeTakeFirst();

    return row ? toRecord(row) : undefined;
  }

  async findAll(filters: EmployeeListFilters): Promise<EmployeeRecord[]> {
    let query = this.db.selectFrom("employees").selectAll();

    if (filters.seniority) {
      query = query.where("seniority", "=", filters.seniority);
    }

    if (filters.skill || filters.proficiency) {
      let skillQuery = this.db
        .selectFrom("employee_skills")
        .innerJoin("skills", "skills.id", "employee_skills.skill_id")
        .select("employee_skills.employee_id");

      if (filters.skill) {
        skillQuery = skillQuery.where("skills.name", "=", filters.skill);
      }
      if (filters.proficiency) {
        skillQuery = skillQuery.where("employee_skills.proficiency", "=", filters.proficiency);
      }

      query = query.where("id", "in", skillQuery);
    }

    const sortColumn = filters.sort === "employmentStartDate" ? "employment_start_date" : "name";
    query = query.orderBy(sortColumn, filters.order ?? "asc");

    const rows = await query.execute();
    return rows.map(toRecord);
  }

  async delete(employeeId: string): Promise<void> {
    await this.db.deleteFrom("employees").where("id", "=", employeeId).execute();
  }

  async hasAnyAssignments(employeeId: string): Promise<boolean> {
    const row = await this.db
      .selectFrom("assignments")
      .select("id")
      .where("employee_id", "=", employeeId)
      .executeTakeFirst();
    return row !== undefined;
  }
}
