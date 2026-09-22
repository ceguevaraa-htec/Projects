import type { Proficiency, ProjectStatus, Seniority } from "../db/schema.js";

export type { Proficiency, ProjectStatus, Seniority };

/** Field names match specs/contracts/openapi-spec.yaml's Employee/EmployeeSummary schemas. */
export interface EmployeeRecord {
  employeeId: string;
  name: string;
  employmentStartDate: string;
  employmentEndDate: string | null;
  seniority: Seniority;
}

export interface EmployeeCreateInput {
  name: string;
  employmentStartDate: string;
  employmentEndDate?: string | null;
  seniority: Seniority;
}

export interface EmployeeUpdateInput {
  name?: string;
  employmentStartDate?: string;
  employmentEndDate?: string | null;
  seniority?: Seniority;
}

export interface EmployeeListFilters {
  skill?: string;
  proficiency?: Proficiency;
  seniority?: Seniority;
  sort?: "name" | "employmentStartDate";
  order?: "asc" | "desc";
}

/** Field names match the OpenAPI EmployeeSkill schema. */
export interface EmployeeSkillRecord {
  skillId: string;
  skillName: string;
  proficiency: Proficiency;
}

/** Field names match the OpenAPI Skill schema. */
export interface SkillRecord {
  skillId: string;
  name: string;
}

/** Field names match the OpenAPI SkillDeletionImpact schema. */
export interface SkillDeletionImpact {
  skillId: string;
  affectedEmployeeCount: number;
  affectedProjectRoleCount: number;
}

/** Field names match the OpenAPI ProjectRole schema. */
export interface ProjectRoleRecord {
  roleId: string;
  projectId: string;
  name: string;
  capacityPercent: number;
  requiredSkills: SkillRecord[];
}

export interface ProjectRoleCreateInput {
  name: string;
  capacityPercent: number;
  requiredSkillIds?: string[];
}

export interface ProjectRoleUpdateInput {
  name?: string;
  capacityPercent?: number;
  requiredSkillIds?: string[];
}

/** Field names match the OpenAPI Project/ProjectSummary schemas. */
export interface ProjectRecord {
  projectId: string;
  name: string;
  status: ProjectStatus;
  startDate: string;
  endDate: string;
}

export interface ProjectCreateInput {
  name: string;
  startDate: string;
  endDate: string;
}

export interface ProjectUpdateInput {
  name?: string;
  startDate?: string;
  endDate?: string;
  status?: ProjectStatus;
}

export interface ProjectListFilters {
  status?: ProjectStatus;
  requiredRole?: string;
  startDateFrom?: string;
  startDateTo?: string;
  sort?: "name" | "startDate" | "endDate";
  order?: "asc" | "desc";
}
