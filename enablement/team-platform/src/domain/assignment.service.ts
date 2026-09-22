import type { AssignmentRepository } from "../repositories/assignment.repository.js";
import type { EmployeeRepository } from "../repositories/employee.repository.js";
import type { ProjectRepository } from "../repositories/project.repository.js";
import type { SkillRepository } from "../repositories/skill.repository.js";
import { includesToday, isInFuture, rangesOverlap } from "./date-utils.js";
import type {
  AssignmentCreateInput,
  AssignmentRecord,
  AssignmentUpdateInput,
  CandidateEmployeeRecord,
  MatchTier,
  Proficiency,
} from "./types.js";
import {
  AssignmentNotCancellableError,
  AssignmentNotEditableError,
  AssignmentNotFoundError,
  CapacityExceededError,
  EmployeeNotFoundError,
  ProjectNotActiveError,
  ProjectNotFoundError,
  ProjectRoleNotFoundError,
  ValidationError,
} from "./errors/domain-errors.js";

/** Business rules for Assignment and the candidates read model (FR-0013–FR-0018). */
export class AssignmentService {
  constructor(
    private readonly assignments: AssignmentRepository,
    private readonly employees: EmployeeRepository,
    private readonly projects: ProjectRepository,
    private readonly skills: SkillRepository,
  ) {}

  private validateCapacityAndDates(input: {
    capacityPercent?: number;
    startDate?: string;
    endDate?: string;
  }): void {
    if (
      input.capacityPercent !== undefined &&
      (input.capacityPercent <= 0 ||
        input.capacityPercent > 100 ||
        !Number.isInteger(input.capacityPercent))
    ) {
      throw new ValidationError("capacityPercent must be an integer greater than 0 and up to 100.");
    }
    if (
      input.startDate !== undefined &&
      input.endDate !== undefined &&
      input.endDate < input.startDate
    ) {
      throw new ValidationError("endDate must not precede startDate.");
    }
  }

  /** Sums capacity across the employee's assignments overlapping [startDate, endDate], excluding `excludeAssignmentId`. */
  private async computeOverlappingCapacity(
    employeeId: string,
    range: { start: string; end: string },
    excludeAssignmentId?: string,
  ): Promise<number> {
    const existing = await this.assignments.findAllForEmployee(employeeId);
    return existing
      .filter((a) => a.assignmentId !== excludeAssignmentId)
      .filter((a) => rangesOverlap(range, { start: a.startDate, end: a.endDate }))
      .reduce((sum, a) => sum + a.capacityPercent, 0);
  }

  async createAssignment(input: AssignmentCreateInput): Promise<AssignmentRecord> {
    if (
      !input.employeeId ||
      !input.projectId ||
      !input.roleId ||
      !input.capacityPercent ||
      !input.startDate ||
      !input.endDate
    ) {
      throw new ValidationError(
        "employeeId, projectId, roleId, capacityPercent, startDate, and endDate are required.",
      );
    }
    this.validateCapacityAndDates(input);

    const employee = await this.employees.findById(input.employeeId);
    if (!employee) {
      throw new EmployeeNotFoundError(input.employeeId);
    }

    const role = await this.projects.findRoleById(input.roleId);
    if (!role) {
      throw new ProjectRoleNotFoundError(input.roleId);
    }
    if (role.projectId !== input.projectId) {
      throw new ValidationError(
        `projectId "${input.projectId}" does not match role "${input.roleId}"'s actual parent project.`,
      );
    }

    const project = await this.projects.findById(input.projectId);
    if (!project) {
      throw new ProjectNotFoundError(input.projectId);
    }
    if (project.status !== "Active") {
      throw new ProjectNotActiveError(input.projectId);
    }

    const overlapping = await this.computeOverlappingCapacity(input.employeeId, {
      start: input.startDate,
      end: input.endDate,
    });
    const wouldBePercent = overlapping + input.capacityPercent;
    if (wouldBePercent > 100) {
      throw new CapacityExceededError(input.employeeId, wouldBePercent);
    }

    return this.assignments.insert(input);
  }

  async getAssignment(assignmentId: string): Promise<AssignmentRecord> {
    const assignment = await this.assignments.findById(assignmentId);
    if (!assignment) {
      throw new AssignmentNotFoundError(assignmentId);
    }
    return assignment;
  }

  async updateAssignment(
    assignmentId: string,
    input: AssignmentUpdateInput,
  ): Promise<AssignmentRecord> {
    const existing = await this.assignments.findById(assignmentId);
    if (!existing) {
      throw new AssignmentNotFoundError(assignmentId);
    }
    if (!isInFuture(existing.startDate)) {
      throw new AssignmentNotEditableError(assignmentId);
    }

    const effectiveRoleId = input.roleId ?? existing.roleId;
    const effectiveCapacity = input.capacityPercent ?? existing.capacityPercent;
    const effectiveStart = input.startDate ?? existing.startDate;
    const effectiveEnd = input.endDate ?? existing.endDate;

    this.validateCapacityAndDates({
      capacityPercent: effectiveCapacity,
      startDate: effectiveStart,
      endDate: effectiveEnd,
    });

    const role = await this.projects.findRoleById(effectiveRoleId);
    if (!role) {
      throw new ProjectRoleNotFoundError(effectiveRoleId);
    }
    const project = await this.projects.findById(role.projectId);
    if (!project) {
      throw new ProjectNotFoundError(role.projectId);
    }
    if (project.status !== "Active") {
      throw new ProjectNotActiveError(role.projectId);
    }

    const overlapping = await this.computeOverlappingCapacity(
      existing.employeeId,
      { start: effectiveStart, end: effectiveEnd },
      assignmentId,
    );
    const wouldBePercent = overlapping + effectiveCapacity;
    if (wouldBePercent > 100) {
      throw new CapacityExceededError(existing.employeeId, wouldBePercent);
    }

    const updated = await this.assignments.update(assignmentId, input);
    if (!updated) {
      throw new AssignmentNotFoundError(assignmentId);
    }
    return updated;
  }

  async cancelAssignment(assignmentId: string): Promise<void> {
    const existing = await this.assignments.findById(assignmentId);
    if (!existing) {
      throw new AssignmentNotFoundError(assignmentId);
    }
    if (!isInFuture(existing.startDate)) {
      throw new AssignmentNotCancellableError(assignmentId);
    }
    await this.assignments.delete(assignmentId);
  }

  /**
   * The ONE shared implementation of "current utilization" — called by both the Employee
   * response path (employees.routes.ts) and the CandidateEmployee response path
   * (listCandidates below). Neither computes this independently. See data-model.md/research.md.
   */
  async getCurrentUtilization(employeeId: string): Promise<number> {
    const all = await this.assignments.findAllForEmployee(employeeId);
    return all
      .filter((a) => includesToday({ start: a.startDate, end: a.endDate }))
      .reduce((sum, a) => sum + a.capacityPercent, 0);
  }

  async listEmployeeAssignments(employeeId: string): Promise<AssignmentRecord[]> {
    return this.assignments.findAllForEmployee(employeeId);
  }

  private computeMatchTier(
    requiredSkillIds: string[],
    employeeProficiencyBySkillId: Map<string, Proficiency>,
  ): MatchTier {
    if (requiredSkillIds.length === 0) {
      return "no_requirement";
    }

    const hasAny = requiredSkillIds.some((id) => employeeProficiencyBySkillId.has(id));
    if (!hasAny) {
      return "no_match";
    }

    const hasAll = requiredSkillIds.every((id) => employeeProficiencyBySkillId.has(id));
    if (!hasAll) {
      return "partial";
    }

    const allAtLeastIntermediate = requiredSkillIds.every(
      (id) => employeeProficiencyBySkillId.get(id) !== "Beginner",
    );
    return allAtLeastIntermediate ? "strong" : "partial";
  }

  async listCandidates(projectId: string, roleId: string): Promise<CandidateEmployeeRecord[]> {
    const project = await this.projects.findById(projectId);
    if (!project) {
      throw new ProjectNotFoundError(projectId);
    }
    const role = await this.projects.findRoleById(roleId);
    if (!role || role.projectId !== projectId) {
      throw new ProjectRoleNotFoundError(roleId);
    }

    const requiredSkillIds = role.requiredSkills.map((s) => s.skillId);
    const allEmployees = await this.employees.findAll({});

    const candidates = await Promise.all(
      allEmployees.map(async (employee) => {
        const employeeSkills = await this.skills.findSkillsForEmployee(employee.employeeId);
        const proficiencyBySkillId = new Map(employeeSkills.map((s) => [s.skillId, s.proficiency]));
        const matchTier = this.computeMatchTier(requiredSkillIds, proficiencyBySkillId);
        const currentUtilizationPercent = await this.getCurrentUtilization(employee.employeeId);

        const candidate: CandidateEmployeeRecord = {
          employeeId: employee.employeeId,
          name: employee.name,
          seniority: employee.seniority,
          currentUtilizationPercent,
          matchTier,
        };
        return candidate;
      }),
    );

    return candidates;
  }
}
