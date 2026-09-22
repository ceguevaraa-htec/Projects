import { describe, expect, it } from "vitest";
import { EmployeeService } from "../../src/domain/employee.service.js";
import { FakeEmployeeRepository, FakeSkillRepository } from "../helpers/fakes.js";
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
  const service = new EmployeeService(employees, skills);
  return { service, employees, skills };
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
