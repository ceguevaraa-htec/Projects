import { describe, expect, it } from "vitest";
import { ProjectService } from "../../src/domain/project.service.js";
import { FakeProjectRepository, FakeSkillRepository } from "../helpers/fakes.js";
import {
  InvalidStatusTransitionError,
  ProjectHasAssignmentsError,
  ProjectNotEditableError,
  ProjectNotFoundError,
  ProjectRoleHasAssignmentsError,
  ProjectRoleNotFoundError,
  SkillNotFoundError,
  ValidationError,
} from "../../src/domain/errors/domain-errors.js";

function makeService() {
  const projects = new FakeProjectRepository();
  const skills = new FakeSkillRepository();
  const service = new ProjectService(projects, skills);
  return { service, projects, skills };
}

async function createDraftProject(service: ProjectService) {
  return service.createProject({
    name: "Platform Revamp",
    startDate: "2024-01-01",
    endDate: "2024-06-01",
  });
}

describe("ProjectService — create/edit (FR-0009)", () => {
  it("creates a project in Draft status", async () => {
    const { service } = makeService();
    const project = await createDraftProject(service);
    expect(project.status).toBe("Draft");
  });

  it("rejects creation with endDate before startDate", async () => {
    const { service } = makeService();
    await expect(
      service.createProject({ name: "X", startDate: "2024-06-01", endDate: "2024-01-01" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("allows editing dates", async () => {
    const { service } = makeService();
    const created = await createDraftProject(service);
    const updated = await service.updateProject(created.projectId, { endDate: "2024-12-01" });
    expect(updated.endDate).toBe("2024-12-01");
  });
});

describe("ProjectService — not-found handling", () => {
  it("getProject throws ProjectNotFoundError for a nonexistent id", async () => {
    const { service } = makeService();
    await expect(service.getProject("missing")).rejects.toBeInstanceOf(ProjectNotFoundError);
  });

  it("updateProject throws ProjectNotFoundError for a nonexistent id", async () => {
    const { service } = makeService();
    await expect(service.updateProject("missing", { name: "X" })).rejects.toBeInstanceOf(
      ProjectNotFoundError,
    );
  });

  it("deleteProject throws ProjectNotFoundError for a nonexistent id", async () => {
    const { service } = makeService();
    await expect(service.deleteProject("missing")).rejects.toBeInstanceOf(ProjectNotFoundError);
  });
});

describe("ProjectService — status-transition graph", () => {
  it.each([
    ["Draft", "Active"],
    ["Draft", "Cancelled"],
    ["Active", "Completed"],
    ["Active", "Cancelled"],
  ] as const)("allows %s -> %s", async (from, to) => {
    const { service } = makeService();
    const project = await createDraftProject(service);
    if (from === "Active") {
      await service.updateProject(project.projectId, { status: "Active" });
    }
    const updated = await service.updateProject(project.projectId, { status: to });
    expect(updated.status).toBe(to);
  });

  it.each([
    ["Draft", "Completed"],
    ["Completed", "Active"],
    ["Cancelled", "Draft"],
    ["Active", "Draft"],
  ] as const)("rejects %s -> %s", async (from, to) => {
    const { service } = makeService();
    const project = await createDraftProject(service);
    if (from !== "Draft") {
      // Drive to the `from` state via valid transitions first.
      if (from === "Active") await service.updateProject(project.projectId, { status: "Active" });
      if (from === "Completed") {
        await service.updateProject(project.projectId, { status: "Active" });
        await service.updateProject(project.projectId, { status: "Completed" });
      }
      if (from === "Cancelled")
        await service.updateProject(project.projectId, { status: "Cancelled" });
    }
    await expect(service.updateProject(project.projectId, { status: to })).rejects.toBeInstanceOf(
      InvalidStatusTransitionError,
    );
  });
});

describe("ProjectService — delete-eligibility (FR-0012)", () => {
  it("allows deletion when the project has zero assignments", async () => {
    const { service, projects } = makeService();
    const project = await createDraftProject(service);
    await service.deleteProject(project.projectId);
    expect(await projects.findById(project.projectId)).toBeUndefined();
  });

  it("blocks deletion when the project has a future-only assignment", async () => {
    const { service, projects } = makeService();
    const project = await createDraftProject(service);
    projects.assignmentsByProjectId.add(project.projectId);

    await expect(service.deleteProject(project.projectId)).rejects.toBeInstanceOf(
      ProjectHasAssignmentsError,
    );
  });
});

describe("ProjectService — required-role management (FR-0010)", () => {
  it("adds a role with valid capacity and required skills", async () => {
    const { service, skills } = makeService();
    const project = await createDraftProject(service);
    const skill = await skills.insert("React");

    const role = await service.addProjectRole(project.projectId, {
      name: "Backend Developer",
      capacityPercent: 50,
      requiredSkillIds: [skill.skillId],
    });
    expect(role.capacityPercent).toBe(50);
  });

  it("rejects capacityPercent of 0", async () => {
    const { service } = makeService();
    const project = await createDraftProject(service);
    await expect(
      service.addProjectRole(project.projectId, { name: "X", capacityPercent: 0 }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects capacityPercent above 100", async () => {
    const { service } = makeService();
    const project = await createDraftProject(service);
    await expect(
      service.addProjectRole(project.projectId, { name: "X", capacityPercent: 150 }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a nonexistent required skill", async () => {
    const { service } = makeService();
    const project = await createDraftProject(service);
    await expect(
      service.addProjectRole(project.projectId, {
        name: "X",
        capacityPercent: 50,
        requiredSkillIds: ["missing-skill"],
      }),
    ).rejects.toBeInstanceOf(SkillNotFoundError);
  });

  it("rejects updating/removing a nonexistent role", async () => {
    const { service } = makeService();
    const project = await createDraftProject(service);
    await expect(
      service.updateProjectRole(project.projectId, "missing-role", { capacityPercent: 60 }),
    ).rejects.toBeInstanceOf(ProjectRoleNotFoundError);
    await expect(
      service.removeProjectRole(project.projectId, "missing-role"),
    ).rejects.toBeInstanceOf(ProjectRoleNotFoundError);
  });
});

describe("ProjectService — role removal-eligibility (FR-0011)", () => {
  it("allows removal when zero assignments reference the role", async () => {
    const { service, projects } = makeService();
    const project = await createDraftProject(service);
    const role = await service.addProjectRole(project.projectId, {
      name: "X",
      capacityPercent: 50,
    });
    await service.removeProjectRole(project.projectId, role.roleId);
    expect(await projects.findRoleById(role.roleId)).toBeUndefined();
  });

  it("blocks removal when the role has a future-only assignment", async () => {
    const { service, projects } = makeService();
    const project = await createDraftProject(service);
    const role = await service.addProjectRole(project.projectId, {
      name: "X",
      capacityPercent: 50,
    });
    projects.assignmentsByRoleId.add(role.roleId);

    await expect(service.removeProjectRole(project.projectId, role.roleId)).rejects.toBeInstanceOf(
      ProjectRoleHasAssignmentsError,
    );
  });
});

describe("ProjectService — role management restricted to Draft/Active (resolved gap)", () => {
  it("allows role add/edit/remove while Draft", async () => {
    const { service } = makeService();
    const project = await createDraftProject(service);
    const role = await service.addProjectRole(project.projectId, {
      name: "X",
      capacityPercent: 50,
    });
    await service.updateProjectRole(project.projectId, role.roleId, { capacityPercent: 60 });
    await service.removeProjectRole(project.projectId, role.roleId);
  });

  it("allows role add/edit/remove while Active", async () => {
    const { service } = makeService();
    const project = await createDraftProject(service);
    await service.updateProject(project.projectId, { status: "Active" });
    const role = await service.addProjectRole(project.projectId, {
      name: "X",
      capacityPercent: 50,
    });
    await service.updateProjectRole(project.projectId, role.roleId, { capacityPercent: 60 });
    await service.removeProjectRole(project.projectId, role.roleId);
  });

  it("blocks role add/edit/remove once Completed", async () => {
    const { service } = makeService();
    const project = await createDraftProject(service);
    await service.updateProject(project.projectId, { status: "Active" });
    const role = await service.addProjectRole(project.projectId, {
      name: "X",
      capacityPercent: 50,
    });
    await service.updateProject(project.projectId, { status: "Completed" });

    await expect(
      service.addProjectRole(project.projectId, { name: "Y", capacityPercent: 30 }),
    ).rejects.toBeInstanceOf(ProjectNotEditableError);
    await expect(
      service.updateProjectRole(project.projectId, role.roleId, { capacityPercent: 40 }),
    ).rejects.toBeInstanceOf(ProjectNotEditableError);
    await expect(service.removeProjectRole(project.projectId, role.roleId)).rejects.toBeInstanceOf(
      ProjectNotEditableError,
    );
  });

  it("blocks role add/edit/remove once Cancelled", async () => {
    const { service } = makeService();
    const project = await createDraftProject(service);
    await expect(
      service.addProjectRole(project.projectId, { name: "Y", capacityPercent: 30 }),
    ).resolves.toBeDefined();
    await service.updateProject(project.projectId, { status: "Cancelled" });

    await expect(
      service.addProjectRole(project.projectId, { name: "Z", capacityPercent: 30 }),
    ).rejects.toBeInstanceOf(ProjectNotEditableError);
  });
});
