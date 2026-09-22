import { describe, expect, it } from "vitest";
import { BenchService } from "../../src/domain/bench.service.js";
import { AssignmentService } from "../../src/domain/assignment.service.js";
import {
  FakeAssignmentRepository,
  FakeEmployeeRepository,
  FakeProjectRepository,
  FakeSkillRepository,
} from "../helpers/fakes.js";
import { addDays, today } from "../../src/domain/date-utils.js";
import { ValidationError } from "../../src/domain/errors/domain-errors.js";

function makeServices() {
  const employees = new FakeEmployeeRepository();
  const skills = new FakeSkillRepository();
  const projects = new FakeProjectRepository();
  const assignments = new FakeAssignmentRepository();
  const benchService = new BenchService(employees, assignments, skills);
  const assignmentService = new AssignmentService(assignments, employees, projects, skills);
  return { benchService, assignmentService, employees, skills, projects, assignments };
}

describe("BenchService — now window (N=0, FR-0019)", () => {
  it("excludes a fully-booked (100%) employee", async () => {
    const { benchService, employees, assignments } = await makeServices();
    const employee = await employees.insert({
      name: "Fully Booked",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    assignments.seed({
      employeeId: employee.employeeId,
      employeeName: employee.name,
      projectId: "p1",
      projectName: "P",
      roleId: "r1",
      roleName: "R",
      capacityPercent: 100,
      startDate: today(),
      endDate: today(),
    });

    const bench = await benchService.getBenchView("now");
    expect(bench.find((e) => e.employeeId === employee.employeeId)).toBeUndefined();
  });

  it("includes a partially-booked employee with their actual current utilization", async () => {
    const { benchService, employees, assignments } = await makeServices();
    const employee = await employees.insert({
      name: "Partially Booked",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    assignments.seed({
      employeeId: employee.employeeId,
      employeeName: employee.name,
      projectId: "p1",
      projectName: "P",
      roleId: "r1",
      roleName: "R",
      capacityPercent: 40,
      startDate: today(),
      endDate: today(),
    });

    const bench = await benchService.getBenchView("now");
    const entry = bench.find((e) => e.employeeId === employee.employeeId);
    expect(entry?.utilizationPercent).toBe(40);
    expect(entry?.availableCapacityPercent).toBe(60);
  });

  it("includes a never-assigned employee at 0%", async () => {
    const { benchService, employees } = await makeServices();
    const employee = await employees.insert({
      name: "Never Assigned",
      employmentStartDate: "2024-01-01",
      seniority: "Junior",
    });

    const bench = await benchService.getBenchView("now");
    const entry = bench.find((e) => e.employeeId === employee.employeeId);
    expect(entry?.utilizationPercent).toBe(0);
  });

  it("rejects a missing or invalid window", async () => {
    const { benchService } = await makeServices();
    await expect(benchService.getBenchView("")).rejects.toBeInstanceOf(ValidationError);
    await expect(benchService.getBenchView("7d")).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("BenchService — busy-then-free case (resolved ambiguity)", () => {
  it("includes an employee 100%-booked for the window's first days but free afterward", async () => {
    const { benchService, employees, assignments } = await makeServices();
    const employee = await employees.insert({
      name: "Busy Then Free",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    assignments.seed({
      employeeId: employee.employeeId,
      employeeName: employee.name,
      projectId: "p1",
      projectName: "P",
      roleId: "r1",
      roleName: "R",
      capacityPercent: 100,
      startDate: today(),
      endDate: addDays(today(), 5),
    });

    const bench = await benchService.getBenchView("30d");
    const entry = bench.find((e) => e.employeeId === employee.employeeId);
    expect(entry).toBeDefined();
    expect(entry?.utilizationPercent).toBe(0);
  });
});

describe("BenchService — two-non-overlapping-partials case (resolved ambiguity)", () => {
  it("includes an employee with two separate 50% assignments in different parts of a 90-day window", async () => {
    const { benchService, employees, assignments } = await makeServices();
    const employee = await employees.insert({
      name: "Two Non-Overlapping Partials",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    assignments.seed({
      employeeId: employee.employeeId,
      employeeName: employee.name,
      projectId: "p1",
      projectName: "P",
      roleId: "r1",
      roleName: "R1",
      capacityPercent: 50,
      startDate: addDays(today(), 1),
      endDate: addDays(today(), 10),
    });
    assignments.seed({
      employeeId: employee.employeeId,
      employeeName: employee.name,
      projectId: "p1",
      projectName: "P",
      roleId: "r2",
      roleName: "R2",
      capacityPercent: 50,
      startDate: addDays(today(), 60),
      endDate: addDays(today(), 70),
    });

    const bench = await benchService.getBenchView("90d");
    const entry = bench.find((e) => e.employeeId === employee.employeeId);
    expect(entry).toBeDefined();
    // Neither assignment overlaps the other, so the minimum per-day concurrent capacity is 0
    // (on any day outside both assignments' ranges) — a whole-range sum would have wrongly
    // computed 100% (50+50) and excluded this employee.
    expect(entry?.utilizationPercent).toBe(0);
  });
});

describe("BenchService — now is a true degenerate case of the window algorithm (SC-002)", () => {
  it("produces the same value as AssignmentService.getCurrentUtilization for the same data", async () => {
    const { benchService, assignmentService, employees, assignments } = await makeServices();
    const employee = await employees.insert({
      name: "Consistency Check",
      employmentStartDate: "2024-01-01",
      seniority: "Mid",
    });
    assignments.seed({
      employeeId: employee.employeeId,
      employeeName: employee.name,
      projectId: "p1",
      projectName: "P",
      roleId: "r1",
      roleName: "R",
      capacityPercent: 65,
      startDate: addDays(today(), -3),
      endDate: addDays(today(), 3),
    });

    const bench = await benchService.getBenchView("now");
    const benchEntry = bench.find((e) => e.employeeId === employee.employeeId);
    const directUtilization = await assignmentService.getCurrentUtilization(employee.employeeId);

    expect(benchEntry?.utilizationPercent).toBe(directUtilization);
  });
});
