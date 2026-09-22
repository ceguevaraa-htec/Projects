import type { EmployeeRepository } from "../repositories/employee.repository.js";
import type { SkillRepository } from "../repositories/skill.repository.js";
import type {
  EmployeeCreateInput,
  EmployeeListFilters,
  EmployeeRecord,
  EmployeeSkillRecord,
  EmployeeUpdateInput,
  Proficiency,
} from "./types.js";
import {
  DuplicateEmployeeSkillError,
  EmployeeHasAssignmentsError,
  EmployeeNotFoundError,
  EmployeeSkillNotFoundError,
  SkillNotFoundError,
  ValidationError,
} from "./errors/domain-errors.js";

/** Business rules for Employee and EmployeeSkill (FR-0001–FR-0005). */
export class EmployeeService {
  constructor(
    private readonly employees: EmployeeRepository,
    private readonly skills: SkillRepository,
  ) {}

  async createEmployee(input: EmployeeCreateInput): Promise<EmployeeRecord> {
    if (!input.name || !input.employmentStartDate || !input.seniority) {
      throw new ValidationError(
        "name, employmentStartDate, and seniority are required to create an employee.",
      );
    }
    if (input.employmentEndDate && input.employmentEndDate < input.employmentStartDate) {
      throw new ValidationError("employmentEndDate must not precede employmentStartDate.");
    }

    return this.employees.insert(input);
  }

  async getEmployee(employeeId: string): Promise<EmployeeRecord> {
    const employee = await this.employees.findById(employeeId);
    if (!employee) {
      throw new EmployeeNotFoundError(employeeId);
    }
    return employee;
  }

  async listEmployees(filters: EmployeeListFilters): Promise<EmployeeRecord[]> {
    return this.employees.findAll(filters);
  }

  async updateEmployee(employeeId: string, input: EmployeeUpdateInput): Promise<EmployeeRecord> {
    const existing = await this.employees.findById(employeeId);
    if (!existing) {
      throw new EmployeeNotFoundError(employeeId);
    }

    const startDate = input.employmentStartDate ?? existing.employmentStartDate;
    const endDate =
      input.employmentEndDate !== undefined ? input.employmentEndDate : existing.employmentEndDate;
    if (endDate && endDate < startDate) {
      throw new ValidationError("employmentEndDate must not precede employmentStartDate.");
    }

    const updated = await this.employees.update(employeeId, input);
    if (!updated) {
      throw new EmployeeNotFoundError(employeeId);
    }
    return updated;
  }

  async deleteEmployee(employeeId: string): Promise<void> {
    const existing = await this.employees.findById(employeeId);
    if (!existing) {
      throw new EmployeeNotFoundError(employeeId);
    }

    const hasAssignments = await this.employees.hasAnyAssignments(employeeId);
    if (hasAssignments) {
      throw new EmployeeHasAssignmentsError(employeeId);
    }

    await this.employees.delete(employeeId);
  }

  async addEmployeeSkill(
    employeeId: string,
    skillId: string,
    proficiency: Proficiency,
  ): Promise<EmployeeSkillRecord> {
    const employee = await this.employees.findById(employeeId);
    if (!employee) {
      throw new EmployeeNotFoundError(employeeId);
    }

    const skill = await this.skills.findById(skillId);
    if (!skill) {
      throw new SkillNotFoundError(skillId);
    }

    const existingAssociation = await this.skills.findEmployeeSkill(employeeId, skillId);
    if (existingAssociation) {
      throw new DuplicateEmployeeSkillError(employeeId, skillId);
    }

    return this.skills.insertEmployeeSkill(employeeId, skillId, proficiency);
  }

  async updateEmployeeSkill(
    employeeId: string,
    skillId: string,
    proficiency: Proficiency,
  ): Promise<EmployeeSkillRecord> {
    const existingAssociation = await this.skills.findEmployeeSkill(employeeId, skillId);
    if (!existingAssociation) {
      throw new EmployeeSkillNotFoundError(employeeId, skillId);
    }

    return this.skills.updateEmployeeSkillProficiency(employeeId, skillId, proficiency);
  }

  async removeEmployeeSkill(employeeId: string, skillId: string): Promise<void> {
    const existingAssociation = await this.skills.findEmployeeSkill(employeeId, skillId);
    if (!existingAssociation) {
      throw new EmployeeSkillNotFoundError(employeeId, skillId);
    }

    await this.skills.deleteEmployeeSkill(employeeId, skillId);
  }

  async listEmployeeSkills(employeeId: string): Promise<EmployeeSkillRecord[]> {
    const employee = await this.employees.findById(employeeId);
    if (!employee) {
      throw new EmployeeNotFoundError(employeeId);
    }
    return this.skills.findSkillsForEmployee(employeeId);
  }
}
