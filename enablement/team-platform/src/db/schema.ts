import type { ColumnType, Generated } from "kysely";

export type Seniority = "Junior" | "Mid" | "Senior";
export type Proficiency = "Beginner" | "Intermediate" | "Expert";
export type ProjectStatus = "Draft" | "Active" | "Completed" | "Cancelled";

export interface EmployeeTable {
  id: Generated<string>;
  name: string;
  employment_start_date: string;
  employment_end_date: string | null;
  seniority: Seniority;
}

export interface SkillTable {
  id: Generated<string>;
  name: string;
}

export interface EmployeeSkillTable {
  employee_id: string;
  skill_id: string;
  proficiency: Proficiency;
  created_at: ColumnType<string, string | undefined, never>;
}

export interface ProjectTable {
  id: Generated<string>;
  name: string;
  start_date: string;
  end_date: string;
  status: ProjectStatus;
}

export interface ProjectRoleTable {
  id: Generated<string>;
  project_id: string;
  name: string;
  capacity_percent: number;
}

export interface ProjectRoleSkillTable {
  project_role_id: string;
  skill_id: string;
}

export interface Database {
  employees: EmployeeTable;
  skills: SkillTable;
  employee_skills: EmployeeSkillTable;
  projects: ProjectTable;
  project_roles: ProjectRoleTable;
  project_role_skills: ProjectRoleSkillTable;
}
