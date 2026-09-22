import { describe, expect, it } from "vitest";
import { ReportsService } from "../../src/domain/reports.service.js";
import { AssignmentService } from "../../src/domain/assignment.service.js";
import {
  FakeAssignmentRepository,
  FakeEmployeeRepository,
  FakeProjectRepository,
  FakeSkillRepository,
} from "../helpers/fakes.js";
import { addDays, today } from "../../src/domain/date-utils.js";
import {
  EmployeeNotFoundError,
  ProjectNotFoundError,
} from "../../src/domain/errors/domain-errors.js";

function makeServices() {
  const employees = new FakeEmployeeRepository();
  const skills = new FakeSkillRepository();
  const projects = new FakeProjectRepository();
  const assignments = new FakeAssignmentRepository();
  const assignmentService = new AssignmentService(assignments, employees, projects, skills);
  const reportsService = new ReportsService(employees, projects, assignments, assignmentService);
  return { reportsService, employees, skills, projects, assignments };
}

describe("ReportsService — org-wide report (FR-0021, current-only)", () => {
  it("returns every employee with current utilization and only current assignments", async () => {
    const { reportsService, employees, assignments } = await makeServices();
    const employee = await employees.insert({
      name: "Ada Lovelace",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    assignments.seed({
      employeeId: employee.employeeId,
      employeeName: employee.name,
      projectId: "p1",
      projectName: "Platform Revamp",
      roleId: "r1",
      roleName: "Engineer",
      capacityPercent: 50,
      startDate: today(),
      endDate: addDays(today(), 5),
    });
    // A future-only assignment must NOT appear in the org-wide report's currentAssignments.
    assignments.seed({
      employeeId: employee.employeeId,
      employeeName: employee.name,
      projectId: "p1",
      projectName: "Platform Revamp",
      roleId: "r1",
      roleName: "Engineer",
      capacityPercent: 30,
      startDate: addDays(today(), 20),
      endDate: addDays(today(), 25),
    });

    const report = await reportsService.assembleOrgReport();
    const entry = report.employees.find((e) => e.employeeId === employee.employeeId);
    expect(entry?.currentUtilizationPercent).toBe(50);
    expect(entry?.currentAssignments).toHaveLength(1);
    expect(entry?.currentAssignments[0].projectName).toBe("Platform Revamp");
  });
});

describe("ReportsService — per-employee report (FR-0022, full history)", () => {
  it("returns full assignment history (past, current, future), not just current", async () => {
    const { reportsService, employees, assignments } = await makeServices();
    const employee = await employees.insert({
      name: "Grace Hopper",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    assignments.seed({
      employeeId: employee.employeeId,
      employeeName: employee.name,
      projectId: "p1",
      projectName: "Legacy Migration",
      roleId: "r1",
      roleName: "Engineer",
      capacityPercent: 40,
      startDate: addDays(today(), -30),
      endDate: addDays(today(), -20),
    });
    assignments.seed({
      employeeId: employee.employeeId,
      employeeName: employee.name,
      projectId: "p2",
      projectName: "Current Project",
      roleId: "r2",
      roleName: "Lead",
      capacityPercent: 60,
      startDate: today(),
      endDate: addDays(today(), 5),
    });
    assignments.seed({
      employeeId: employee.employeeId,
      employeeName: employee.name,
      projectId: "p3",
      projectName: "Future Project",
      roleId: "r3",
      roleName: "Consultant",
      capacityPercent: 20,
      startDate: addDays(today(), 30),
      endDate: addDays(today(), 40),
    });

    const report = await reportsService.assembleEmployeeReport(employee.employeeId);
    expect(report.assignments).toHaveLength(3);
    const statuses = report.assignments.map((a) => a.temporalStatus).sort();
    expect(statuses).toEqual(["current", "future", "past"]);
  });

  it("throws EmployeeNotFoundError for a nonexistent id", async () => {
    const { reportsService } = await makeServices();
    await expect(reportsService.assembleEmployeeReport("missing")).rejects.toBeInstanceOf(
      EmployeeNotFoundError,
    );
  });
});

describe("ReportsService — per-project report (FR-0023, current-only resolved gap)", () => {
  it("returns required roles with only currently-assigned employees, not full history", async () => {
    const { reportsService, employees, projects, assignments } = await makeServices();
    const project = await projects.insert({
      name: "Data Platform",
      startDate: "2024-01-01",
      endDate: "2024-12-31",
    });
    const role = await projects.insertRole(project.projectId, {
      name: "Backend Engineer",
      capacityPercent: 100,
    });
    const currentEmployee = await employees.insert({
      name: "Current Staffer",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    const pastEmployee = await employees.insert({
      name: "Past Staffer",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    assignments.seed({
      employeeId: currentEmployee.employeeId,
      employeeName: currentEmployee.name,
      projectId: project.projectId,
      projectName: project.name,
      roleId: role.roleId,
      roleName: role.name,
      capacityPercent: 80,
      startDate: today(),
      endDate: addDays(today(), 10),
    });
    assignments.seed({
      employeeId: pastEmployee.employeeId,
      employeeName: pastEmployee.name,
      projectId: project.projectId,
      projectName: project.name,
      roleId: role.roleId,
      roleName: role.name,
      capacityPercent: 50,
      startDate: addDays(today(), -30),
      endDate: addDays(today(), -10),
    });

    const report = await reportsService.assembleProjectReport(project.projectId);
    expect(report.roles).toHaveLength(1);
    expect(report.roles[0].assignedEmployees).toHaveLength(1);
    expect(report.roles[0].assignedEmployees[0].employeeName).toBe("Current Staffer");
  });

  it("throws ProjectNotFoundError for a nonexistent id", async () => {
    const { reportsService } = await makeServices();
    await expect(reportsService.assembleProjectReport("missing")).rejects.toBeInstanceOf(
      ProjectNotFoundError,
    );
  });
});
