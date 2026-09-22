import { describe, expect, it } from "vitest";
import { EmployeeService } from "../../src/domain/employee.service.js";
import { AssignmentService } from "../../src/domain/assignment.service.js";
import {
  FakeAssignmentRepository,
  FakeEmployeeRepository,
  FakeProjectRepository,
  FakeSkillRepository,
} from "../helpers/fakes.js";
import { addDays, today } from "../../src/domain/date-utils.js";
import {
  DuplicateEmployeeSkillError,
  EmployeeHasAssignmentsError,
  EmployeeNotFoundError,
  EmployeeSkillNotFoundError,
  SkillNotFoundError,
  ValidationError,
} from "../../src/domain/errors/domain-errors.js";

function makeService() {
  const employees = new FakeEmployeeRepository();
  const skills = new FakeSkillRepository();
  const projects = new FakeProjectRepository();
  const assignmentRepository = new FakeAssignmentRepository();
  const assignmentService = new AssignmentService(
    assignmentRepository,
    employees,
    projects,
    skills,
  );
  const service = new EmployeeService(employees, skills, assignmentService);
  return { service, employees, skills, assignmentRepository };
}

describe("EmployeeService — create/edit (FR-0001/FR-0002)", () => {
  it("creates an employee with valid required fields", async () => {
    const { service } = makeService();
    const employee = await service.createEmployee({
      name: "Ada Lovelace",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    expect(employee.name).toBe("Ada Lovelace");
    expect(employee.employeeId).toBeTruthy();
  });

  it("rejects creation missing required fields", async () => {
    const { service } = makeService();
    await expect(
      service.createEmployee({ name: "", employmentStartDate: "2024-01-01", seniority: "Junior" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("allows a partial update", async () => {
    const { service } = makeService();
    const created = await service.createEmployee({
      name: "Grace Hopper",
      employmentStartDate: "2024-01-01",
      seniority: "Mid",
    });
    const updated = await service.updateEmployee(created.employeeId, { seniority: "Senior" });
    expect(updated.seniority).toBe("Senior");
    expect(updated.name).toBe("Grace Hopper");
  });
});

describe("EmployeeService — not-found handling", () => {
  it("getEmployee throws EmployeeNotFoundError for a nonexistent id", async () => {
    const { service } = makeService();
    await expect(service.getEmployee("missing-id")).rejects.toBeInstanceOf(EmployeeNotFoundError);
  });

  it("updateEmployee throws EmployeeNotFoundError for a nonexistent id", async () => {
    const { service } = makeService();
    await expect(service.updateEmployee("missing-id", { name: "X" })).rejects.toBeInstanceOf(
      EmployeeNotFoundError,
    );
  });

  it("deleteEmployee throws EmployeeNotFoundError for a nonexistent id", async () => {
    const { service } = makeService();
    await expect(service.deleteEmployee("missing-id")).rejects.toBeInstanceOf(
      EmployeeNotFoundError,
    );
  });
});

describe("EmployeeService — delete-eligibility (FR-0003)", () => {
  it("allows deletion when the employee has zero assignments", async () => {
    const { service, employees } = makeService();
    const created = await service.createEmployee({
      name: "Alan Turing",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    await service.deleteEmployee(created.employeeId);
    expect(await employees.findById(created.employeeId)).toBeUndefined();
  });

  it("blocks deletion when the employee has a future-only assignment", async () => {
    const { service, employees } = makeService();
    const created = await service.createEmployee({
      name: "Margaret Hamilton",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    employees.assignmentsByEmployeeId.add(created.employeeId);

    await expect(service.deleteEmployee(created.employeeId)).rejects.toBeInstanceOf(
      EmployeeHasAssignmentsError,
    );
  });
});

describe("EmployeeService — skill associations (FR-0004/FR-0005)", () => {
  it("associates a skill with a proficiency", async () => {
    const { service, skills } = makeService();
    const employee = await service.createEmployee({
      name: "Katherine Johnson",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    const skill = await skills.insert("React");

    const association = await service.addEmployeeSkill(
      employee.employeeId,
      skill.skillId,
      "Intermediate",
    );
    expect(association.proficiency).toBe("Intermediate");
  });

  it("rejects a duplicate employee-skill association", async () => {
    const { service, skills } = makeService();
    const employee = await service.createEmployee({
      name: "Radia Perlman",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    const skill = await skills.insert("Networking");
    await service.addEmployeeSkill(employee.employeeId, skill.skillId, "Expert");

    await expect(
      service.addEmployeeSkill(employee.employeeId, skill.skillId, "Beginner"),
    ).rejects.toBeInstanceOf(DuplicateEmployeeSkillError);
  });

  it("rejects associating a skill that does not exist in the catalog", async () => {
    const { service } = makeService();
    const employee = await service.createEmployee({
      name: "Hedy Lamarr",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    await expect(
      service.addEmployeeSkill(employee.employeeId, "missing-skill", "Beginner"),
    ).rejects.toBeInstanceOf(SkillNotFoundError);
  });

  it("rejects associating a skill to a nonexistent employee (checked before skill existence)", async () => {
    const { service } = makeService();
    await expect(
      service.addEmployeeSkill("missing-employee", "missing-skill", "Beginner"),
    ).rejects.toBeInstanceOf(EmployeeNotFoundError);
  });

  it("rejects updating a nonexistent (employee, skill) association", async () => {
    const { service } = makeService();
    const employee = await service.createEmployee({
      name: "Mary Jackson",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    await expect(
      service.updateEmployeeSkill(employee.employeeId, "missing-skill", "Expert"),
    ).rejects.toBeInstanceOf(EmployeeSkillNotFoundError);
  });

  it("rejects removing a nonexistent (employee, skill) association", async () => {
    const { service } = makeService();
    const employee = await service.createEmployee({
      name: "Dorothy Vaughan",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    await expect(
      service.removeEmployeeSkill(employee.employeeId, "missing-skill"),
    ).rejects.toBeInstanceOf(EmployeeSkillNotFoundError);
  });

  it("updates proficiency and removes an association", async () => {
    const { service, skills } = makeService();
    const employee = await service.createEmployee({
      name: "Annie Easley",
      employmentStartDate: "2024-01-01",
      seniority: "Mid",
    });
    const skill = await skills.insert("Python");
    await service.addEmployeeSkill(employee.employeeId, skill.skillId, "Beginner");

    const updated = await service.updateEmployeeSkill(employee.employeeId, skill.skillId, "Expert");
    expect(updated.proficiency).toBe("Expert");

    await service.removeEmployeeSkill(employee.employeeId, skill.skillId);
    await expect(
      service.updateEmployeeSkill(employee.employeeId, skill.skillId, "Expert"),
    ).rejects.toBeInstanceOf(EmployeeSkillNotFoundError);
  });
});

describe("EmployeeService — listEmployees minAvailability/sort=utilization (EPIC-0006)", () => {
  it("filters by minAvailability using a single computed utilization pass", async () => {
    const { service, assignmentRepository } = makeService();
    const busy = await service.createEmployee({
      name: "Busy",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    const free = await service.createEmployee({
      name: "Free",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    assignmentRepository.seed({
      employeeId: busy.employeeId,
      employeeName: busy.name,
      projectId: "p1",
      projectName: "P1",
      roleId: "r1",
      roleName: "Engineer",
      capacityPercent: 90,
      startDate: today(),
      endDate: addDays(today(), 5),
    });
    assignmentRepository.seed({
      employeeId: free.employeeId,
      employeeName: free.name,
      projectId: "p1",
      projectName: "P1",
      roleId: "r1",
      roleName: "Engineer",
      capacityPercent: 60,
      startDate: today(),
      endDate: addDays(today(), 5),
    });

    const result = await service.listEmployees({ minAvailability: 30 });

    expect(result.map((e) => e.employeeId)).toEqual([free.employeeId]);
    expect(result[0].currentUtilizationPercent).toBe(60);
  });

  it("sorts by utilization ascending/descending without a second computation", async () => {
    const { service, assignmentRepository } = makeService();
    const low = await service.createEmployee({
      name: "Low",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    const mid = await service.createEmployee({
      name: "Mid",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    const high = await service.createEmployee({
      name: "High",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    for (const [employee, capacityPercent] of [
      [low, 20],
      [mid, 50],
      [high, 80],
    ] as const) {
      assignmentRepository.seed({
        employeeId: employee.employeeId,
        employeeName: employee.name,
        projectId: "p1",
        projectName: "P1",
        roleId: "r1",
        roleName: "Engineer",
        capacityPercent,
        startDate: today(),
        endDate: addDays(today(), 5),
      });
    }

    const asc = await service.listEmployees({ sort: "utilization", order: "asc" });
    expect(asc.map((e) => e.currentUtilizationPercent)).toEqual([20, 50, 80]);

    const desc = await service.listEmployees({ sort: "utilization", order: "desc" });
    expect(desc.map((e) => e.currentUtilizationPercent)).toEqual([80, 50, 20]);
  });
});
