import type { ProjectRepository } from "../repositories/project.repository.js";
import type { SkillRepository } from "../repositories/skill.repository.js";
import type {
  ProjectCreateInput,
  ProjectListFilters,
  ProjectRecord,
  ProjectRoleCreateInput,
  ProjectRoleRecord,
  ProjectRoleUpdateInput,
  ProjectStatus,
  ProjectUpdateInput,
} from "./types.js";
import {
  InvalidStatusTransitionError,
  ProjectHasAssignmentsError,
  ProjectNotEditableError,
  ProjectNotFoundError,
  ProjectRoleHasAssignmentsError,
  ProjectRoleNotFoundError,
  SkillNotFoundError,
  ValidationError,
} from "./errors/domain-errors.js";

/**
 * Allowed status transitions (research.md): Draft→Active→{Completed,Cancelled}, Draft→Cancelled.
 * No path back from Completed or Cancelled. Server-side enforced, not merely a UI constraint.
 */
const ALLOWED_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  Draft: ["Active", "Cancelled"],
  Active: ["Completed", "Cancelled"],
  Completed: [],
  Cancelled: [],
};

/** Business rules for Project and ProjectRole (FR-0009–FR-0012). */
export class ProjectService {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly skills: SkillRepository,
  ) {}

  async createProject(input: ProjectCreateInput): Promise<ProjectRecord> {
    if (!input.name || !input.startDate || !input.endDate) {
      throw new ValidationError("name, startDate, and endDate are required to create a project.");
    }
    if (input.endDate < input.startDate) {
      throw new ValidationError("endDate must not precede startDate.");
    }

    return this.projects.insert(input);
  }

  async getProject(projectId: string): Promise<ProjectRecord> {
    const project = await this.projects.findById(projectId);
    if (!project) {
      throw new ProjectNotFoundError(projectId);
    }
    return project;
  }

  async listProjects(filters: ProjectListFilters): Promise<ProjectRecord[]> {
    return this.projects.findAll(filters);
  }

  async updateProject(projectId: string, input: ProjectUpdateInput): Promise<ProjectRecord> {
    const existing = await this.projects.findById(projectId);
    if (!existing) {
      throw new ProjectNotFoundError(projectId);
    }

    const startDate = input.startDate ?? existing.startDate;
    const endDate = input.endDate ?? existing.endDate;
    if (endDate < startDate) {
      throw new ValidationError("endDate must not precede startDate.");
    }

    if (input.status !== undefined && input.status !== existing.status) {
      const allowed = ALLOWED_TRANSITIONS[existing.status];
      if (!allowed.includes(input.status)) {
        throw new InvalidStatusTransitionError(existing.status, input.status);
      }
    }

    const updated = await this.projects.update(projectId, input);
    if (!updated) {
      throw new ProjectNotFoundError(projectId);
    }
    return updated;
  }

  async deleteProject(projectId: string): Promise<void> {
    const existing = await this.projects.findById(projectId);
    if (!existing) {
      throw new ProjectNotFoundError(projectId);
    }

    const hasAssignments = await this.projects.hasAnyAssignments(projectId);
    if (hasAssignments) {
      throw new ProjectHasAssignmentsError(projectId);
    }

    await this.projects.delete(projectId);
  }

  private async assertEditableProject(projectId: string): Promise<ProjectRecord> {
    const project = await this.projects.findById(projectId);
    if (!project) {
      throw new ProjectNotFoundError(projectId);
    }
    if (project.status === "Completed" || project.status === "Cancelled") {
      throw new ProjectNotEditableError(projectId, project.status);
    }
    return project;
  }

  private async validateRoleInput(input: {
    name?: string;
    capacityPercent?: number;
    requiredSkillIds?: string[];
  }): Promise<void> {
    if (input.name !== undefined && !input.name.trim()) {
      throw new ValidationError("name is required for a project role.");
    }
    if (
      input.capacityPercent !== undefined &&
      (input.capacityPercent <= 0 ||
        input.capacityPercent > 100 ||
        !Number.isInteger(input.capacityPercent))
    ) {
      throw new ValidationError("capacityPercent must be an integer greater than 0 and up to 100.");
    }
    if (input.requiredSkillIds) {
      for (const skillId of input.requiredSkillIds) {
        const skill = await this.skills.findById(skillId);
        if (!skill) {
          throw new SkillNotFoundError(skillId);
        }
      }
    }
  }

  async addProjectRole(
    projectId: string,
    input: ProjectRoleCreateInput,
  ): Promise<ProjectRoleRecord> {
    await this.assertEditableProject(projectId);

    if (!input.name || !input.capacityPercent) {
      throw new ValidationError("name and capacityPercent are required to create a project role.");
    }
    await this.validateRoleInput(input);

    return this.projects.insertRole(projectId, input);
  }

  async updateProjectRole(
    projectId: string,
    roleId: string,
    input: ProjectRoleUpdateInput,
  ): Promise<ProjectRoleRecord> {
    await this.assertEditableProject(projectId);

    const existingRole = await this.projects.findRoleById(roleId);
    if (!existingRole) {
      throw new ProjectRoleNotFoundError(roleId);
    }
    await this.validateRoleInput(input);

    const updated = await this.projects.updateRole(roleId, input);
    if (!updated) {
      throw new ProjectRoleNotFoundError(roleId);
    }
    return updated;
  }

  async removeProjectRole(projectId: string, roleId: string): Promise<void> {
    await this.assertEditableProject(projectId);

    const existingRole = await this.projects.findRoleById(roleId);
    if (!existingRole) {
      throw new ProjectRoleNotFoundError(roleId);
    }

    const hasAssignments = await this.projects.roleHasAnyAssignments(roleId);
    if (hasAssignments) {
      throw new ProjectRoleHasAssignmentsError(roleId);
    }

    await this.projects.deleteRole(roleId);
  }

  async listProjectRoles(projectId: string): Promise<ProjectRoleRecord[]> {
    const project = await this.projects.findById(projectId);
    if (!project) {
      throw new ProjectNotFoundError(projectId);
    }
    return this.projects.findRolesForProject(projectId);
  }
}
