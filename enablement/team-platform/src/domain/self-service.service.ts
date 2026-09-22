import type { EmployeeRepository } from "../repositories/employee.repository.js";
import type { AssignmentService } from "./assignment.service.js";
import type { AssignmentRecord } from "./types.js";
import { EmployeeNotFoundError } from "./errors/domain-errors.js";

export interface MyAssignmentsData {
  employeeId: string;
  name: string;
  currentUtilizationPercent: number;
  assignments: AssignmentRecord[];
}

/**
 * FR-0024 (EPIC-0005). Composes three already-existing calls — EmployeeRepository.findById,
 * AssignmentService.listEmployeeAssignments, AssignmentService.getCurrentUtilization — into the
 * MyAssignmentsResponse shape. No new repository/service method, no new date logic; see
 * specs/005-employee-self-service/research.md.
 */
export class SelfServiceService {
  constructor(
    private readonly employees: EmployeeRepository,
    private readonly assignments: AssignmentService,
  ) {}

  async getMyAssignments(employeeId: string): Promise<MyAssignmentsData> {
    const employee = await this.employees.findById(employeeId);
    if (!employee) {
      throw new EmployeeNotFoundError(employeeId);
    }

    const [currentUtilizationPercent, assignments] = await Promise.all([
      this.assignments.getCurrentUtilization(employeeId),
      this.assignments.listEmployeeAssignments(employeeId),
    ]);

    return {
      employeeId: employee.employeeId,
      name: employee.name,
      currentUtilizationPercent,
      assignments,
    };
  }
}
