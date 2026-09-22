import type { ColumnType, Generated } from "kysely";

export type Seniority = "Junior" | "Mid" | "Senior";
export type Proficiency = "Beginner" | "Intermediate" | "Expert";

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

export interface Database {
  employees: EmployeeTable;
  skills: SkillTable;
  employee_skills: EmployeeSkillTable;
}
