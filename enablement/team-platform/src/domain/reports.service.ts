import type { EmployeeRepository } from "../repositories/employee.repository.js";
import type { ProjectRepository } from "../repositories/project.repository.js";
import type { AssignmentRepository } from "../repositories/assignment.repository.js";
import type { AssignmentService } from "./assignment.service.js";
import { EmployeeNotFoundError, ProjectNotFoundError } from "./errors/domain-errors.js";

/**
 * Internal report-data shapes — not constrained by openapi-spec.yaml, since the three report
 * endpoints return application/pdf binary with no JSON schema (see research.md's decision).
 * pdf-renderer.ts consumes these shapes only; it never imports a repository type.
 */

export interface OrgReportEmployeeEntry {
  employeeId: string;
  name: string;
  seniority: string;
  currentUtilizationPercent: number;
  currentAssignments: Array<{ projectName: string; roleName: string; capacityPercent: number }>;
}

export interface OrgReportData {
  employees: OrgReportEmployeeEntry[];
}

export interface EmployeeReportAssignmentEntry {
  projectName: string;
  roleName: string;
  capacityPercent: number;
  startDate: string;
  endDate: string;
  temporalStatus: string;
}

export interface EmployeeReportData {
  employeeId: string;
  name: string;
  seniority: string;
  currentUtilizationPercent: number;
  assignments: EmployeeReportAssignmentEntry[];
}

export interface ProjectReportRoleEntry {
  roleName: string;
  capacityPercent: number;
  assignedEmployees: Array<{ employeeName: string; capacityPercent: number }>;
}

export interface ProjectReportData {
  projectId: string;
  name: string;
  status: string;
  startDate: string;
  endDate: string;
  roles: ProjectReportRoleEntry[];
}

/**
 * Report-data assembly (FR-0021–FR-0023), living in Domain Logic per the SDP's Architectural
 * Design Rationale — see research.md. Both the org-wide and per-project scopes are current-only
 * (resolved gap, see spec.md's Assumptions); the per-employee scope is full history, per the
 * PRD's explicit wording for FR-0022.
 */
export class ReportsService {
  constructor(
    private readonly employees: EmployeeRepository,
    private readonly projects: ProjectRepository,
    private readonly assignments: AssignmentRepository,
    private readonly assignmentService: AssignmentService,
  ) {}

  async assembleOrgReport(): Promise<OrgReportData> {
    const allEmployees = await this.employees.findAll({});

    const employeeEntries = await Promise.all(
      allEmployees.map(async (employee) => {
        const [currentUtilizationPercent, allAssignments] = await Promise.all([
          this.assignmentService.getCurrentUtilization(employee.employeeId),
          this.assignments.findAllForEmployee(employee.employeeId),
        ]);

        const currentAssignments = allAssignments
          .filter((a) => a.temporalStatus === "current")
          .map((a) => ({
            projectName: a.projectName,
            roleName: a.roleName,
            capacityPercent: a.capacityPercent,
          }));

        const entry: OrgReportEmployeeEntry = {
          employeeId: employee.employeeId,
          name: employee.name,
          seniority: employee.seniority,
          currentUtilizationPercent,
          currentAssignments,
        };
        return entry;
      }),
    );

    return { employees: employeeEntries };
  }

  async assembleEmployeeReport(employeeId: string): Promise<EmployeeReportData> {
    const employee = await this.employees.findById(employeeId);
    if (!employee) {
      throw new EmployeeNotFoundError(employeeId);
    }

    const [currentUtilizationPercent, allAssignments] = await Promise.all([
      this.assignmentService.getCurrentUtilization(employeeId),
      this.assignments.findAllForEmployee(employeeId),
    ]);

    return {
      employeeId: employee.employeeId,
      name: employee.name,
      seniority: employee.seniority,
      currentUtilizationPercent,
      assignments: allAssignments.map((a) => ({
        projectName: a.projectName,
        roleName: a.roleName,
        capacityPercent: a.capacityPercent,
        startDate: a.startDate,
        endDate: a.endDate,
        temporalStatus: a.temporalStatus,
      })),
    };
  }

  async assembleProjectReport(projectId: string): Promise<ProjectReportData> {
    const project = await this.projects.findById(projectId);
    if (!project) {
      throw new ProjectNotFoundError(projectId);
    }

    const [roles, projectAssignments] = await Promise.all([
      this.projects.findRolesForProject(projectId),
      this.assignments.findAllForProject(projectId),
    ]);

    const currentAssignments = projectAssignments.filter((a) => a.temporalStatus === "current");

    const roleEntries: ProjectReportRoleEntry[] = roles.map((role) => ({
      roleName: role.name,
      capacityPercent: role.capacityPercent,
      assignedEmployees: currentAssignments
        .filter((a) => a.roleId === role.roleId)
        .map((a) => ({ employeeName: a.employeeName, capacityPercent: a.capacityPercent })),
    }));

    return {
      projectId: project.projectId,
      name: project.name,
      status: project.status,
      startDate: project.startDate,
      endDate: project.endDate,
      roles: roleEntries,
    };
  }
}
