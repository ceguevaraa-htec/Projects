import { describe, expect, it } from "vitest";
import { AssignmentService } from "../../src/domain/assignment.service.js";
import {
  FakeAssignmentRepository,
  FakeEmployeeRepository,
  FakeProjectRepository,
  FakeSkillRepository,
} from "../helpers/fakes.js";
import {
  AssignmentNotCancellableError,
  AssignmentNotEditableError,
  AssignmentNotFoundError,
  CapacityExceededError,
  EmployeeNotFoundError,
  ProjectNotActiveError,
  ProjectRoleNotFoundError,
  ValidationError,
} from "../../src/domain/errors/domain-errors.js";

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function todayIso(): string {
  return addDays(new Date().toISOString().slice(0, 10), 0);
}

async function makeService() {
  const employees = new FakeEmployeeRepository();
  const skills = new FakeSkillRepository();
  const projects = new FakeProjectRepository();
  const assignments = new FakeAssignmentRepository();
  const service = new AssignmentService(assignments, employees, projects, skills);
  return { service, employees, skills, projects, assignments };
}

async function setupActiveProjectWithRole(projects: FakeProjectRepository, capacityPercent = 100) {
  const project = await projects.insert({
    name: "Platform Revamp",
    startDate: "2024-01-01",
    endDate: "2024-12-31",
  });
  await projects.update(project.projectId, { status: "Active" });
  const role = await projects.insertRole(project.projectId, {
    name: "Engineer",
    capacityPercent,
  });
  return { project, role };
}

describe("AssignmentService — creation validation (FR-0013)", () => {
  it("creates a valid assignment", async () => {
    const { service, employees, projects } = await makeService();
    const employee = await employees.insert({
      name: "Ada Lovelace",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    const { project, role } = await setupActiveProjectWithRole(projects);

    const assignment = await service.createAssignment({
      employeeId: employee.employeeId,
      projectId: project.projectId,
      roleId: role.roleId,
      capacityPercent: 60,
      startDate: addDays(todayIso(), 1),
      endDate: addDays(todayIso(), 10),
    });
    expect(assignment.capacityPercent).toBe(60);
  });

  it("rejects capacityPercent of 0 or above 100", async () => {
    const { service, employees, projects } = await makeService();
    const employee = await employees.insert({
      name: "Grace Hopper",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    const { project, role } = await setupActiveProjectWithRole(projects);
    const base = {
      employeeId: employee.employeeId,
      projectId: project.projectId,
      roleId: role.roleId,
      startDate: addDays(todayIso(), 1),
      endDate: addDays(todayIso(), 10),
    };

    await expect(service.createAssignment({ ...base, capacityPercent: 0 })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(
      service.createAssignment({ ...base, capacityPercent: 150 }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a mismatched projectId/roleId pair (resolved gap)", async () => {
    const { service, employees, projects } = await makeService();
    const employee = await employees.insert({
      name: "Alan Turing",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    const { role } = await setupActiveProjectWithRole(projects);
    const otherProject = await projects.insert({
      name: "Other Project",
      startDate: "2024-01-01",
      endDate: "2024-12-31",
    });

    await expect(
      service.createAssignment({
        employeeId: employee.employeeId,
        projectId: otherProject.projectId,
        roleId: role.roleId,
        capacityPercent: 50,
        startDate: addDays(todayIso(), 1),
        endDate: addDays(todayIso(), 10),
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a nonexistent employee or role", async () => {
    const { service, projects } = await makeService();
    const { project, role } = await setupActiveProjectWithRole(projects);

    await expect(
      service.createAssignment({
        employeeId: "missing",
        projectId: project.projectId,
        roleId: role.roleId,
        capacityPercent: 50,
        startDate: addDays(todayIso(), 1),
        endDate: addDays(todayIso(), 10),
      }),
    ).rejects.toBeInstanceOf(EmployeeNotFoundError);
  });
});

describe("AssignmentService — capacity validation (FR-0014)", () => {
  it("allows an assignment that keeps overlapping-date total at or below 100%", async () => {
    const { service, employees, projects } = await makeService();
    const employee = await employees.insert({
      name: "Katherine Johnson",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    const { project, role } = await setupActiveProjectWithRole(projects);

    await service.createAssignment({
      employeeId: employee.employeeId,
      projectId: project.projectId,
      roleId: role.roleId,
      capacityPercent: 50,
      startDate: addDays(todayIso(), 1),
      endDate: addDays(todayIso(), 10),
    });

    const second = await service.createAssignment({
      employeeId: employee.employeeId,
      projectId: project.projectId,
      roleId: role.roleId,
      capacityPercent: 50,
      startDate: addDays(todayIso(), 1),
      endDate: addDays(todayIso(), 10),
    });
    expect(second.capacityPercent).toBe(50);
  });

  it("blocks an assignment that would push overlapping-date total above 100%", async () => {
    const { service, employees, projects } = await makeService();
    const employee = await employees.insert({
      name: "Margaret Hamilton",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    const { project, role } = await setupActiveProjectWithRole(projects);

    await service.createAssignment({
      employeeId: employee.employeeId,
      projectId: project.projectId,
      roleId: role.roleId,
      capacityPercent: 60,
      startDate: addDays(todayIso(), 1),
      endDate: addDays(todayIso(), 10),
    });

    await expect(
      service.createAssignment({
        employeeId: employee.employeeId,
        projectId: project.projectId,
        roleId: role.roleId,
        capacityPercent: 50,
        startDate: addDays(todayIso(), 5),
        endDate: addDays(todayIso(), 15),
      }),
    ).rejects.toBeInstanceOf(CapacityExceededError);
  });

  it("allows a non-overlapping assignment regardless of the other assignment's capacity", async () => {
    const { service, employees, projects } = await makeService();
    const employee = await employees.insert({
      name: "Dorothy Vaughan",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    const { project, role } = await setupActiveProjectWithRole(projects);

    await service.createAssignment({
      employeeId: employee.employeeId,
      projectId: project.projectId,
      roleId: role.roleId,
      capacityPercent: 100,
      startDate: addDays(todayIso(), 1),
      endDate: addDays(todayIso(), 10),
    });

    const nonOverlapping = await service.createAssignment({
      employeeId: employee.employeeId,
      projectId: project.projectId,
      roleId: role.roleId,
      capacityPercent: 100,
      startDate: addDays(todayIso(), 20),
      endDate: addDays(todayIso(), 30),
    });
    expect(nonOverlapping.capacityPercent).toBe(100);
  });
});

describe("AssignmentService — active-project restriction (FR-0015)", () => {
  it("allows creation against an Active project", async () => {
    const { service, employees, projects } = await makeService();
    const employee = await employees.insert({
      name: "Mary Jackson",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    const { project, role } = await setupActiveProjectWithRole(projects);

    await expect(
      service.createAssignment({
        employeeId: employee.employeeId,
        projectId: project.projectId,
        roleId: role.roleId,
        capacityPercent: 50,
        startDate: addDays(todayIso(), 1),
        endDate: addDays(todayIso(), 10),
      }),
    ).resolves.toBeDefined();
  });

  it.each(["Draft", "Completed", "Cancelled"] as const)(
    "rejects creation against a %s project",
    async (status) => {
      const { service, employees, projects } = await makeService();
      const employee = await employees.insert({
        name: "Annie Easley",
        employmentStartDate: "2024-01-01",
        seniority: "Senior",
      });
      const project = await projects.insert({
        name: "Not Active",
        startDate: "2024-01-01",
        endDate: "2024-12-31",
      });
      await projects.update(project.projectId, { status });
      const role = await projects.insertRole(project.projectId, {
        name: "Engineer",
        capacityPercent: 100,
      });

      await expect(
        service.createAssignment({
          employeeId: employee.employeeId,
          projectId: project.projectId,
          roleId: role.roleId,
          capacityPercent: 50,
          startDate: addDays(todayIso(), 1),
          endDate: addDays(todayIso(), 10),
        }),
      ).rejects.toBeInstanceOf(ProjectNotActiveError);
    },
  );
});

describe("AssignmentService — edit (FR-0016)", () => {
  it("edits a future-dated assignment, re-running capacity/active-project validation", async () => {
    const { service, employees, projects } = await makeService();
    const employee = await employees.insert({
      name: "Hedy Lamarr",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    const { project, role } = await setupActiveProjectWithRole(projects);
    const assignment = await service.createAssignment({
      employeeId: employee.employeeId,
      projectId: project.projectId,
      roleId: role.roleId,
      capacityPercent: 50,
      startDate: addDays(todayIso(), 1),
      endDate: addDays(todayIso(), 10),
    });

    const updated = await service.updateAssignment(assignment.assignmentId, {
      capacityPercent: 80,
    });
    expect(updated.capacityPercent).toBe(80);
  });

  it("throws AssignmentNotFoundError for a nonexistent id", async () => {
    const { service } = await makeService();
    await expect(
      service.updateAssignment("missing", { capacityPercent: 50 }),
    ).rejects.toBeInstanceOf(AssignmentNotFoundError);
  });

  it("excludes the assignment being edited from its own overlap check", async () => {
    const { service, employees, projects } = await makeService();
    const employee = await employees.insert({
      name: "Radia Perlman",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    const { project, role } = await setupActiveProjectWithRole(projects);
    const assignment = await service.createAssignment({
      employeeId: employee.employeeId,
      projectId: project.projectId,
      roleId: role.roleId,
      capacityPercent: 90,
      startDate: addDays(todayIso(), 1),
      endDate: addDays(todayIso(), 10),
    });

    // Editing this assignment's own capacity upward should not be blocked by itself.
    const updated = await service.updateAssignment(assignment.assignmentId, {
      capacityPercent: 100,
    });
    expect(updated.capacityPercent).toBe(100);
  });

  it("blocks editing an assignment whose start date is today or in the past", async () => {
    const { service, assignments } = await makeService();
    const seeded = assignments.seed({
      employeeId: "employee-1",
      employeeName: "Past Employee",
      projectId: "project-1",
      projectName: "Past Project",
      roleId: "role-1",
      roleName: "Engineer",
      capacityPercent: 50,
      startDate: todayIso(),
      endDate: addDays(todayIso(), 10),
    });

    await expect(
      service.updateAssignment(seeded.assignmentId, { capacityPercent: 60 }),
    ).rejects.toBeInstanceOf(AssignmentNotEditableError);
  });
});

describe("AssignmentService — cancel (FR-0017)", () => {
  it("cancels a future-dated assignment, freeing its capacity", async () => {
    const { service, employees, projects, assignments } = await makeService();
    const employee = await employees.insert({
      name: "Barbara Liskov",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    const { project, role } = await setupActiveProjectWithRole(projects);
    const assignment = await service.createAssignment({
      employeeId: employee.employeeId,
      projectId: project.projectId,
      roleId: role.roleId,
      capacityPercent: 50,
      startDate: addDays(todayIso(), 1),
      endDate: addDays(todayIso(), 10),
    });

    await service.cancelAssignment(assignment.assignmentId);
    expect(await assignments.findById(assignment.assignmentId)).toBeUndefined();
  });

  it("throws AssignmentNotFoundError for a nonexistent id", async () => {
    const { service } = await makeService();
    await expect(service.cancelAssignment("missing")).rejects.toBeInstanceOf(
      AssignmentNotFoundError,
    );
  });

  it("blocks cancelling an assignment whose start date is today or in the past", async () => {
    const { service, assignments } = await makeService();
    const seeded = assignments.seed({
      employeeId: "employee-1",
      employeeName: "Past Employee",
      projectId: "project-1",
      projectName: "Past Project",
      roleId: "role-1",
      roleName: "Engineer",
      capacityPercent: 50,
      startDate: addDays(todayIso(), -5),
      endDate: addDays(todayIso(), -1),
    });

    await expect(service.cancelAssignment(seeded.assignmentId)).rejects.toBeInstanceOf(
      AssignmentNotCancellableError,
    );
  });
});

describe("AssignmentService — skill-match tier (FR-0018)", () => {
  it("computes strong/partial/no_match/no_requirement tiers correctly", async () => {
    const { service, employees, skills, projects } = await makeService();
    const project = await projects.insert({
      name: "Data Platform",
      startDate: "2024-01-01",
      endDate: "2024-12-31",
    });
    const reactSkill = await skills.insert("React");
    const sqlSkill = await skills.insert("SQL");
    const role = await projects.insertRole(project.projectId, {
      name: "Full Stack Engineer",
      capacityPercent: 100,
      requiredSkillIds: [reactSkill.skillId, sqlSkill.skillId],
    });

    const strongEmployee = await employees.insert({
      name: "Strong Candidate",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    await skills.insertEmployeeSkill(strongEmployee.employeeId, reactSkill.skillId, "Expert");
    await skills.insertEmployeeSkill(strongEmployee.employeeId, sqlSkill.skillId, "Intermediate");

    const partialEmployee = await employees.insert({
      name: "Partial Candidate",
      employmentStartDate: "2024-01-01",
      seniority: "Mid",
    });
    await skills.insertEmployeeSkill(partialEmployee.employeeId, reactSkill.skillId, "Beginner");

    const noMatchEmployee = await employees.insert({
      name: "No Match Candidate",
      employmentStartDate: "2024-01-01",
      seniority: "Junior",
    });

    const candidates = await service.listCandidates(project.projectId, role.roleId);
    expect(candidates).toHaveLength(3);

    const byId = new Map(candidates.map((c) => [c.employeeId, c]));
    expect(byId.get(strongEmployee.employeeId)?.matchTier).toBe("strong");
    expect(byId.get(partialEmployee.employeeId)?.matchTier).toBe("partial");
    expect(byId.get(noMatchEmployee.employeeId)?.matchTier).toBe("no_match");
  });

  it("returns no_requirement for a role with zero required skills, never filtering candidates", async () => {
    const { service, employees, projects } = await makeService();
    const project = await projects.insert({
      name: "Open Role Project",
      startDate: "2024-01-01",
      endDate: "2024-12-31",
    });
    const role = await projects.insertRole(project.projectId, {
      name: "Generalist",
      capacityPercent: 100,
    });
    const employee = await employees.insert({
      name: "Anyone",
      employmentStartDate: "2024-01-01",
      seniority: "Junior",
    });

    const candidates = await service.listCandidates(project.projectId, role.roleId);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].employeeId).toBe(employee.employeeId);
    expect(candidates[0].matchTier).toBe("no_requirement");
  });

  it("rejects a nonexistent role for the candidates endpoint", async () => {
    const { service, projects } = await makeService();
    const project = await projects.insert({
      name: "Some Project",
      startDate: "2024-01-01",
      endDate: "2024-12-31",
    });
    await expect(service.listCandidates(project.projectId, "missing-role")).rejects.toBeInstanceOf(
      ProjectRoleNotFoundError,
    );
  });
});

describe("AssignmentService — getCurrentUtilization (shared function, data-model.md)", () => {
  it("sums capacity only across assignments whose date range includes today", async () => {
    const { service, employees, projects } = await makeService();
    const employee = await employees.insert({
      name: "Shafi Goldwasser",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    const { project, role } = await setupActiveProjectWithRole(projects);

    // Current assignment (includes today).
    await service.createAssignment({
      employeeId: employee.employeeId,
      projectId: project.projectId,
      roleId: role.roleId,
      capacityPercent: 40,
      startDate: addDays(todayIso(), -5),
      endDate: addDays(todayIso(), 5),
    });
    // Future-only assignment (does not include today) — must not be counted.
    await service.createAssignment({
      employeeId: employee.employeeId,
      projectId: project.projectId,
      roleId: role.roleId,
      capacityPercent: 30,
      startDate: addDays(todayIso(), 10),
      endDate: addDays(todayIso(), 20),
    });

    expect(await service.getCurrentUtilization(employee.employeeId)).toBe(40);
  });

  it("returns 0 for an employee with no current assignments", async () => {
    const { service, employees } = await makeService();
    const employee = await employees.insert({
      name: "No Assignments",
      employmentStartDate: "2024-01-01",
      seniority: "Junior",
    });
    expect(await service.getCurrentUtilization(employee.employeeId)).toBe(0);
  });
});
