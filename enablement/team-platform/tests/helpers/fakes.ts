import { randomUUID } from "node:crypto";
import type { EmployeeRepository } from "../../src/repositories/employee.repository.js";
import type { SkillRepository } from "../../src/repositories/skill.repository.js";
import type { ProjectRepository } from "../../src/repositories/project.repository.js";
import type { AssignmentRepository } from "../../src/repositories/assignment.repository.js";
import type {
  AssignmentCreateInput,
  AssignmentRecord,
  AssignmentUpdateInput,
  EmployeeCreateInput,
  EmployeeListFilters,
  EmployeeRecord,
  EmployeeSkillRecord,
  EmployeeUpdateInput,
  Proficiency,
  ProjectCreateInput,
  ProjectListFilters,
  ProjectRecord,
  ProjectRoleCreateInput,
  ProjectRoleRecord,
  ProjectRoleUpdateInput,
  ProjectUpdateInput,
  SkillRecord,
} from "../../src/domain/types.js";
import { includesToday, isInFuture } from "../../src/domain/date-utils.js";

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
  /**
   * Settable per-test, mirroring the real countProjectRoleAssociations query now that EPIC-0002
   * has replaced the EPIC-0001 hardcoded-0 stub with a real one (see skill.repository.ts).
   * Lets skill.service.test.ts assert getDeletionImpact reflects a real, non-zero count.
   */
  public projectRoleAssociationCounts = new Map<string, number>();

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

  async countProjectRoleAssociations(skillId: string): Promise<number> {
    return this.projectRoleAssociationCounts.get(skillId) ?? 0;
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

/**
 * In-memory test double for ProjectRepository, used by Domain Logic unit tests. Mirrors
 * FakeEmployeeRepository's pattern: `assignmentsByProjectId`/`assignmentsByRoleId` are settable
 * per-test, independent of the real repository's hardcoded-false stubs, so the "blocked"
 * branches are exercisable here even though they can't be integration-tested until EPIC-0003.
 */
export class FakeProjectRepository implements ProjectRepository {
  private readonly projects = new Map<string, ProjectRecord>();
  private readonly roles = new Map<string, ProjectRoleRecord>();
  public assignmentsByProjectId = new Set<string>();
  public assignmentsByRoleId = new Set<string>();

  async insert(input: ProjectCreateInput): Promise<ProjectRecord> {
    const record: ProjectRecord = {
      projectId: randomUUID(),
      name: input.name,
      startDate: input.startDate,
      endDate: input.endDate,
      status: "Draft",
    };
    this.projects.set(record.projectId, record);
    return record;
  }

  async update(projectId: string, input: ProjectUpdateInput): Promise<ProjectRecord | undefined> {
    const existing = this.projects.get(projectId);
    if (!existing) return undefined;
    const updated: ProjectRecord = { ...existing, ...input };
    this.projects.set(projectId, updated);
    return updated;
  }

  async findById(projectId: string): Promise<ProjectRecord | undefined> {
    return this.projects.get(projectId);
  }

  async findAll(_filters: ProjectListFilters): Promise<ProjectRecord[]> {
    return [...this.projects.values()];
  }

  async delete(projectId: string): Promise<void> {
    this.projects.delete(projectId);
  }

  async hasAnyAssignments(projectId: string): Promise<boolean> {
    return this.assignmentsByProjectId.has(projectId);
  }

  async insertRole(projectId: string, input: ProjectRoleCreateInput): Promise<ProjectRoleRecord> {
    const record: ProjectRoleRecord = {
      roleId: randomUUID(),
      projectId,
      name: input.name,
      capacityPercent: input.capacityPercent,
      requiredSkills: (input.requiredSkillIds ?? []).map((skillId) => ({ skillId, name: "" })),
    };
    this.roles.set(record.roleId, record);
    return record;
  }

  async updateRole(
    roleId: string,
    input: ProjectRoleUpdateInput,
  ): Promise<ProjectRoleRecord | undefined> {
    const existing = this.roles.get(roleId);
    if (!existing) return undefined;
    const updated: ProjectRoleRecord = {
      ...existing,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.capacityPercent !== undefined ? { capacityPercent: input.capacityPercent } : {}),
      ...(input.requiredSkillIds !== undefined
        ? { requiredSkills: input.requiredSkillIds.map((skillId) => ({ skillId, name: "" })) }
        : {}),
    };
    this.roles.set(roleId, updated);
    return updated;
  }

  async deleteRole(roleId: string): Promise<void> {
    this.roles.delete(roleId);
  }

  async findRoleById(roleId: string): Promise<ProjectRoleRecord | undefined> {
    return this.roles.get(roleId);
  }

  async findRolesForProject(projectId: string): Promise<ProjectRoleRecord[]> {
    return [...this.roles.values()].filter((r) => r.projectId === projectId);
  }

  async roleHasAnyAssignments(roleId: string): Promise<boolean> {
    return this.assignmentsByRoleId.has(roleId);
  }
}

/**
 * In-memory test double for AssignmentRepository, used by assignment.service.test.ts. Exposes
 * `seed` to insert a record directly (e.g., a past-dated assignment) without going through the
 * normal `insert` flow, since Domain Logic's own creation rules would otherwise be bypassed by
 * definition when testing edit/cancel against an already-started assignment.
 */
export class FakeAssignmentRepository implements AssignmentRepository {
  private readonly rows = new Map<string, AssignmentRecord>();

  private computeTemporalStatus(
    startDate: string,
    endDate: string,
  ): AssignmentRecord["temporalStatus"] {
    if (isInFuture(startDate)) return "future";
    if (includesToday({ start: startDate, end: endDate })) return "current";
    return "past";
  }

  seed(
    record: Omit<AssignmentRecord, "assignmentId" | "temporalStatus"> & { assignmentId?: string },
  ): AssignmentRecord {
    const full: AssignmentRecord = {
      assignmentId: record.assignmentId ?? randomUUID(),
      employeeId: record.employeeId,
      employeeName: record.employeeName,
      projectId: record.projectId,
      projectName: record.projectName,
      roleId: record.roleId,
      roleName: record.roleName,
      capacityPercent: record.capacityPercent,
      startDate: record.startDate,
      endDate: record.endDate,
      temporalStatus: this.computeTemporalStatus(record.startDate, record.endDate),
    };
    this.rows.set(full.assignmentId, full);
    return full;
  }

  async insert(input: AssignmentCreateInput): Promise<AssignmentRecord> {
    return this.seed({
      employeeId: input.employeeId,
      employeeName: "",
      projectId: input.projectId,
      projectName: "",
      roleId: input.roleId,
      roleName: "",
      capacityPercent: input.capacityPercent,
      startDate: input.startDate,
      endDate: input.endDate,
    });
  }

  async update(
    assignmentId: string,
    input: AssignmentUpdateInput,
  ): Promise<AssignmentRecord | undefined> {
    const existing = this.rows.get(assignmentId);
    if (!existing) return undefined;
    const updated: AssignmentRecord = {
      ...existing,
      ...(input.roleId !== undefined ? { roleId: input.roleId } : {}),
      ...(input.capacityPercent !== undefined ? { capacityPercent: input.capacityPercent } : {}),
      ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
      ...(input.endDate !== undefined ? { endDate: input.endDate } : {}),
    };
    updated.temporalStatus = this.computeTemporalStatus(updated.startDate, updated.endDate);
    this.rows.set(assignmentId, updated);
    return updated;
  }

  async findById(assignmentId: string): Promise<AssignmentRecord | undefined> {
    return this.rows.get(assignmentId);
  }

  async findAllForEmployee(employeeId: string): Promise<AssignmentRecord[]> {
    return [...this.rows.values()].filter((r) => r.employeeId === employeeId);
  }

  async delete(assignmentId: string): Promise<void> {
    this.rows.delete(assignmentId);
  }
}
