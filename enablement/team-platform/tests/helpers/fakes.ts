import { randomUUID } from "node:crypto";
import type { EmployeeRepository } from "../../src/repositories/employee.repository.js";
import type { SkillRepository } from "../../src/repositories/skill.repository.js";
import type {
  EmployeeCreateInput,
  EmployeeListFilters,
  EmployeeRecord,
  EmployeeSkillRecord,
  EmployeeUpdateInput,
  Proficiency,
  SkillRecord,
} from "../../src/domain/types.js";

/**
 * In-memory test double for EmployeeRepository, used by Domain Logic unit tests so they don't
 * depend on a real database (per research.md: unit tests use "a repository test double or an
 * in-memory SQLite instance"). `hasAnyAssignments` is settable per-test, independent of the
 * real repository's hardcoded-false stub, so the "blocked" branch is exercisable here even
 * though it can't be integration-tested until EPIC-0003 (see spec.md Assumptions).
 */
export class FakeEmployeeRepository implements EmployeeRepository {
  private readonly rows = new Map<string, EmployeeRecord>();
  public assignmentsByEmployeeId = new Set<string>();

  async insert(input: EmployeeCreateInput): Promise<EmployeeRecord> {
    const record: EmployeeRecord = {
      employeeId: randomUUID(),
      name: input.name,
      employmentStartDate: input.employmentStartDate,
      employmentEndDate: input.employmentEndDate ?? null,
      seniority: input.seniority,
    };
    this.rows.set(record.employeeId, record);
    return record;
  }

  async update(
    employeeId: string,
    input: EmployeeUpdateInput,
  ): Promise<EmployeeRecord | undefined> {
    const existing = this.rows.get(employeeId);
    if (!existing) return undefined;
    const updated: EmployeeRecord = { ...existing, ...input };
    this.rows.set(employeeId, updated);
    return updated;
  }

  async findById(employeeId: string): Promise<EmployeeRecord | undefined> {
    return this.rows.get(employeeId);
  }

  async findAll(_filters: EmployeeListFilters): Promise<EmployeeRecord[]> {
    return [...this.rows.values()];
  }

  async delete(employeeId: string): Promise<void> {
    this.rows.delete(employeeId);
  }

  async hasAnyAssignments(employeeId: string): Promise<boolean> {
    return this.assignmentsByEmployeeId.has(employeeId);
  }
}

/** In-memory test double for SkillRepository, used by Domain Logic unit tests. */
export class FakeSkillRepository implements SkillRepository {
  private readonly skills = new Map<string, SkillRecord>();
  private readonly associations = new Map<string, EmployeeSkillRecord>();

  private key(employeeId: string, skillId: string): string {
    return `${employeeId}::${skillId}`;
  }

  async insert(name: string): Promise<SkillRecord> {
    const record: SkillRecord = { skillId: randomUUID(), name };
    this.skills.set(record.skillId, record);
    return record;
  }

  async update(skillId: string, name: string): Promise<SkillRecord | undefined> {
    const existing = this.skills.get(skillId);
    if (!existing) return undefined;
    const updated = { ...existing, name };
    this.skills.set(skillId, updated);
    return updated;
  }

  async findById(skillId: string): Promise<SkillRecord | undefined> {
    return this.skills.get(skillId);
  }

  async findAll(): Promise<SkillRecord[]> {
    return [...this.skills.values()];
  }

  async findByName(name: string): Promise<SkillRecord | undefined> {
    return [...this.skills.values()].find((s) => s.name.toLowerCase() === name.toLowerCase());
  }

  async delete(skillId: string): Promise<void> {
    this.skills.delete(skillId);
    for (const key of [...this.associations.keys()]) {
      if (key.endsWith(`::${skillId}`)) this.associations.delete(key);
    }
  }

  async countEmployeeAssociations(skillId: string): Promise<number> {
    return [...this.associations.values()].filter((a) => a.skillId === skillId).length;
  }

  async countProjectRoleAssociations(_skillId: string): Promise<number> {
    return 0;
  }

  async findEmployeeSkill(
    employeeId: string,
    skillId: string,
  ): Promise<EmployeeSkillRecord | undefined> {
    return this.associations.get(this.key(employeeId, skillId));
  }

  async findSkillsForEmployee(employeeId: string): Promise<EmployeeSkillRecord[]> {
    return [...this.associations.entries()]
      .filter(([key]) => key.startsWith(`${employeeId}::`))
      .map(([, value]) => value);
  }

  async insertEmployeeSkill(
    employeeId: string,
    skillId: string,
    proficiency: Proficiency,
  ): Promise<EmployeeSkillRecord> {
    const skill = this.skills.get(skillId);
    const record: EmployeeSkillRecord = { skillId, skillName: skill?.name ?? "", proficiency };
    this.associations.set(this.key(employeeId, skillId), record);
    return record;
  }

  async updateEmployeeSkillProficiency(
    employeeId: string,
    skillId: string,
    proficiency: Proficiency,
  ): Promise<EmployeeSkillRecord> {
    const existing = this.associations.get(this.key(employeeId, skillId));
    const record: EmployeeSkillRecord = {
      skillId,
      skillName: existing?.skillName ?? "",
      proficiency,
    };
    this.associations.set(this.key(employeeId, skillId), record);
    return record;
  }

  async deleteEmployeeSkill(employeeId: string, skillId: string): Promise<void> {
    this.associations.delete(this.key(employeeId, skillId));
  }
}
