import type { Proficiency, Seniority } from "../db/schema.js";

export type { Proficiency, Seniority };

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
