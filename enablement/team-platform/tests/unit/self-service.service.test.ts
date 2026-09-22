import { describe, expect, it } from "vitest";
import { SelfServiceService } from "../../src/domain/self-service.service.js";
import { AssignmentService } from "../../src/domain/assignment.service.js";
import {
  FakeAssignmentRepository,
  FakeEmployeeRepository,
  FakeProjectRepository,
  FakeSkillRepository,
} from "../helpers/fakes.js";
import { addDays, today } from "../../src/domain/date-utils.js";
import { EmployeeNotFoundError } from "../../src/domain/errors/domain-errors.js";

function makeServices() {
  const employees = new FakeEmployeeRepository();
  const skills = new FakeSkillRepository();
  const projects = new FakeProjectRepository();
  const assignments = new FakeAssignmentRepository();
  const assignmentService = new AssignmentService(assignments, employees, projects, skills);
  const selfServiceService = new SelfServiceService(employees, assignmentService);
  return { selfServiceService, assignmentService, employees, assignments };
}

describe("SelfServiceService — getMyAssignments (FR-0024)", () => {
  it("returns the employee's full history and current utilization, matching the shared implementations", async () => {
    const { selfServiceService, assignmentService, employees, assignments } = makeServices();
    const employee = await employees.insert({
      name: "Ada Lovelace",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    assignments.seed({
      employeeId: employee.employeeId,
      employeeName: employee.name,
      projectId: "p1",
      projectName: "Past Project",
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

    const [expectedUtilization, expectedAssignments] = await Promise.all([
      assignmentService.getCurrentUtilization(employee.employeeId),
      assignmentService.listEmployeeAssignments(employee.employeeId),
    ]);

    const result = await selfServiceService.getMyAssignments(employee.employeeId);

    expect(result.employeeId).toBe(employee.employeeId);
    expect(result.name).toBe("Ada Lovelace");
    expect(result.currentUtilizationPercent).toBe(expectedUtilization);
    expect(result.assignments).toEqual(expectedAssignments);
    expect(result.assignments).toHaveLength(3);
  });

  it("throws EmployeeNotFoundError for a nonexistent employeeId", async () => {
    const { selfServiceService } = makeServices();
    await expect(selfServiceService.getMyAssignments("missing")).rejects.toBeInstanceOf(
      EmployeeNotFoundError,
    );
  });
});
