import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/api/app.js";
import { createTestDb, type TestDb } from "../helpers/db.js";

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function todayIso(): string {
  return addDays(new Date().toISOString().slice(0, 10), 0);
}

async function setupActiveProjectWithRole(
  app: ReturnType<typeof createApp>,
  roleName = "Engineer",
) {
  const project = await request(app)
    .post("/projects")
    .send({
      name: `Test Project ${roleName} ${Math.random()}`,
      startDate: "2024-01-01",
      endDate: "2024-12-31",
    });
  await request(app).patch(`/projects/${project.body.projectId}`).send({ status: "Active" });
  const role = await request(app)
    .post(`/projects/${project.body.projectId}/roles`)
    .send({ name: roleName, capacityPercent: 100 });
  return {
    projectId: project.body.projectId as string,
    projectName: project.body.name as string,
    roleId: role.body.roleId as string,
  };
}

describe("Employees API (integration)", () => {
  let testDb: TestDb;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    testDb = await createTestDb();
    app = createApp(testDb.db);
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  it("creates, edits, and deletes an employee (FR-0001–FR-0003)", async () => {
    const created = await request(app).post("/employees").send({
      name: "Ada Lovelace",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    expect(created.status).toBe(201);
    expect(created.body.name).toBe("Ada Lovelace");
    const employeeId = created.body.employeeId as string;

    const edited = await request(app).patch(`/employees/${employeeId}`).send({ seniority: "Mid" });
    expect(edited.status).toBe(200);
    expect(edited.body.seniority).toBe("Mid");

    const deleted = await request(app).delete(`/employees/${employeeId}`).send();
    expect(deleted.status).toBe(204);

    const afterDelete = await request(app).get(`/employees/${employeeId}`).send();
    expect(afterDelete.status).toBe(404);
    expect(afterDelete.body.error_code).toBe("NOT_FOUND");
  });

  it("returns 404 EmployeeNotFoundError for GET/PATCH/DELETE on a nonexistent id", async () => {
    const getRes = await request(app).get("/employees/does-not-exist").send();
    expect(getRes.status).toBe(404);
    expect(getRes.body.error_code).toBe("NOT_FOUND");

    const patchRes = await request(app).patch("/employees/does-not-exist").send({ name: "X" });
    expect(patchRes.status).toBe(404);
    expect(patchRes.body.error_code).toBe("NOT_FOUND");

    const deleteRes = await request(app).delete("/employees/does-not-exist").send();
    expect(deleteRes.status).toBe(404);
    expect(deleteRes.body.error_code).toBe("NOT_FOUND");
  });

  it("associates, updates, and removes an employee's skill (FR-0004/FR-0005)", async () => {
    const employee = await request(app).post("/employees").send({
      name: "Grace Hopper",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    const skill = await request(app).post("/skills").send({ name: "COBOL" });
    const employeeId = employee.body.employeeId as string;
    const skillId = skill.body.skillId as string;

    const associated = await request(app)
      .post(`/employees/${employeeId}/skills`)
      .send({ skillId, proficiency: "Expert" });
    expect(associated.status).toBe(201);
    expect(associated.body.proficiency).toBe("Expert");

    const duplicate = await request(app)
      .post(`/employees/${employeeId}/skills`)
      .send({ skillId, proficiency: "Beginner" });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error_code).toBe("DUPLICATE_EMPLOYEE_SKILL");

    const updated = await request(app)
      .patch(`/employees/${employeeId}/skills/${skillId}`)
      .send({ proficiency: "Intermediate" });
    expect(updated.status).toBe(200);
    expect(updated.body.proficiency).toBe("Intermediate");

    const removed = await request(app).delete(`/employees/${employeeId}/skills/${skillId}`).send();
    expect(removed.status).toBe(204);

    const afterRemoval = await request(app)
      .patch(`/employees/${employeeId}/skills/${skillId}`)
      .send({ proficiency: "Expert" });
    expect(afterRemoval.status).toBe(404);
    expect(afterRemoval.body.error_code).toBe("EMPLOYEE_SKILL_NOT_FOUND");
  });

  it("rejects associating a skill to a nonexistent employee (FR-0004)", async () => {
    const skill = await request(app).post("/skills").send({ name: "Fortran" });
    const res = await request(app)
      .post(`/employees/does-not-exist/skills`)
      .send({ skillId: skill.body.skillId, proficiency: "Beginner" });
    expect(res.status).toBe(404);
    expect(res.body.error_code).toBe("NOT_FOUND");
  });

  it("blocks deleting an employee with a real assignment, and reflects real utilization/assignments (EPIC-0003 discharge of T044)", async () => {
    const employee = await request(app).post("/employees").send({
      name: "Katherine Johnson",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    const employeeId = employee.body.employeeId as string;

    const project = await request(app).post("/projects").send({
      name: "Apollo Trajectory",
      startDate: "2024-01-01",
      endDate: "2024-12-31",
    });
    await request(app).patch(`/projects/${project.body.projectId}`).send({ status: "Active" });
    const role = await request(app)
      .post(`/projects/${project.body.projectId}/roles`)
      .send({ name: "Analyst", capacityPercent: 100 });

    const today = new Date().toISOString().slice(0, 10);
    await request(app).post("/assignments").send({
      employeeId,
      projectId: project.body.projectId,
      roleId: role.body.roleId,
      capacityPercent: 60,
      startDate: today,
      endDate: today,
    });

    const beforeDelete = await request(app).get(`/employees/${employeeId}`).send();
    expect(beforeDelete.body.currentUtilizationPercent).toBe(60);
    expect(beforeDelete.body.assignments).toHaveLength(1);

    const deleteRes = await request(app).delete(`/employees/${employeeId}`).send();
    expect(deleteRes.status).toBe(409);
    expect(deleteRes.body.error_code).toBe("EMPLOYEE_HAS_ASSIGNMENTS");
  });
});

describe("GET /employees — minAvailability filter (EPIC-0006, US1)", () => {
  let testDb: TestDb;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    testDb = await createTestDb();
    app = createApp(testDb.db);
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  it("returns only employees with at least the requested available capacity", async () => {
    const { projectId, roleId } = await setupActiveProjectWithRole(app);
    const busy = await request(app).post("/employees").send({
      name: "60 Percent",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    const free = await request(app).post("/employees").send({
      name: "10 Percent",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    await request(app).post("/assignments").send({
      employeeId: busy.body.employeeId,
      projectId,
      roleId,
      capacityPercent: 60,
      startDate: todayIso(),
      endDate: todayIso(),
    });
    await request(app).post("/assignments").send({
      employeeId: free.body.employeeId,
      projectId,
      roleId,
      capacityPercent: 90,
      startDate: todayIso(),
      endDate: todayIso(),
    });

    const res = await request(app).get("/employees?minAvailability=30").send();
    expect(res.status).toBe(200);
    const ids = res.body.map((e: { employeeId: string }) => e.employeeId);
    expect(ids).toContain(busy.body.employeeId);
    expect(ids).not.toContain(free.body.employeeId);
  });

  it("minAvailability=0 includes every employee, including a fully-booked one", async () => {
    const { projectId, roleId } = await setupActiveProjectWithRole(app);
    const fullyBooked = await request(app).post("/employees").send({
      name: "Fully Booked MinAvail0",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    await request(app).post("/assignments").send({
      employeeId: fullyBooked.body.employeeId,
      projectId,
      roleId,
      capacityPercent: 100,
      startDate: todayIso(),
      endDate: todayIso(),
    });

    const res = await request(app).get("/employees?minAvailability=0").send();
    expect(res.status).toBe(200);
    const ids = res.body.map((e: { employeeId: string }) => e.employeeId);
    expect(ids).toContain(fullyBooked.body.employeeId);
  });

  it("minAvailability=100 includes only employees with zero current assignments", async () => {
    const { projectId, roleId } = await setupActiveProjectWithRole(app);
    const staffed = await request(app).post("/employees").send({
      name: "Staffed MinAvail100",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    const unstaffed = await request(app).post("/employees").send({
      name: "Unstaffed MinAvail100",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    await request(app).post("/assignments").send({
      employeeId: staffed.body.employeeId,
      projectId,
      roleId,
      capacityPercent: 10,
      startDate: todayIso(),
      endDate: todayIso(),
    });

    const res = await request(app).get("/employees?minAvailability=100").send();
    expect(res.status).toBe(200);
    const ids = res.body.map((e: { employeeId: string }) => e.employeeId);
    expect(ids).not.toContain(staffed.body.employeeId);
    expect(ids).toContain(unstaffed.body.employeeId);
  });

  it("composes with an existing filter (skill)", async () => {
    const { projectId, roleId } = await setupActiveProjectWithRole(app);
    const skill = await request(app)
      .post("/skills")
      .send({ name: `Rust-${Math.random()}` });
    const matchBoth = await request(app).post("/employees").send({
      name: "Matches Both",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    const matchSkillOnly = await request(app).post("/employees").send({
      name: "Matches Skill Only",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    await request(app)
      .post(`/employees/${matchBoth.body.employeeId}/skills`)
      .send({ skillId: skill.body.skillId, proficiency: "Expert" });
    await request(app)
      .post(`/employees/${matchSkillOnly.body.employeeId}/skills`)
      .send({ skillId: skill.body.skillId, proficiency: "Expert" });
    await request(app).post("/assignments").send({
      employeeId: matchSkillOnly.body.employeeId,
      projectId,
      roleId,
      capacityPercent: 90,
      startDate: todayIso(),
      endDate: todayIso(),
    });

    const res = await request(app)
      .get(`/employees?skill=${encodeURIComponent(skill.body.name)}&minAvailability=30`)
      .send();
    expect(res.status).toBe(200);
    const ids = res.body.map((e: { employeeId: string }) => e.employeeId);
    expect(ids).toContain(matchBoth.body.employeeId);
    expect(ids).not.toContain(matchSkillOnly.body.employeeId);
  });

  it.each([["-5"], ["abc"], ["150"]])(
    "rejects minAvailability=%s with 400 VALIDATION_ERROR",
    async (value) => {
      const res = await request(app).get(`/employees?minAvailability=${value}`).send();
      expect(res.status).toBe(400);
      expect(res.body.error_code).toBe("VALIDATION_ERROR");
    },
  );
});

describe("GET /employees — sort=utilization (EPIC-0006, US2)", () => {
  let testDb: TestDb;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    testDb = await createTestDb();
    app = createApp(testDb.db);
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  async function seedThreeAtDistinctUtilization() {
    const { projectId, roleId } = await setupActiveProjectWithRole(app);
    const low = await request(app).post("/employees").send({
      name: "Utilization 20",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    const mid = await request(app).post("/employees").send({
      name: "Utilization 50",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    const high = await request(app).post("/employees").send({
      name: "Utilization 80",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    for (const [employee, capacityPercent] of [
      [low, 20],
      [mid, 50],
      [high, 80],
    ] as const) {
      await request(app).post("/assignments").send({
        employeeId: employee.body.employeeId,
        projectId,
        roleId,
        capacityPercent,
        startDate: todayIso(),
        endDate: todayIso(),
      });
    }
    return { low, mid, high };
  }

  it("returns employees in ascending utilization order", async () => {
    const { low, mid, high } = await seedThreeAtDistinctUtilization();
    const res = await request(app).get("/employees?sort=utilization&order=asc").send();
    const ids = res.body.map((e: { employeeId: string }) => e.employeeId);
    const lowIndex = ids.indexOf(low.body.employeeId);
    const midIndex = ids.indexOf(mid.body.employeeId);
    const highIndex = ids.indexOf(high.body.employeeId);
    expect(lowIndex).toBeLessThan(midIndex);
    expect(midIndex).toBeLessThan(highIndex);
  });

  it("returns employees in descending utilization order", async () => {
    const { low, mid, high } = await seedThreeAtDistinctUtilization();
    const res = await request(app).get("/employees?sort=utilization&order=desc").send();
    const ids = res.body.map((e: { employeeId: string }) => e.employeeId);
    const lowIndex = ids.indexOf(low.body.employeeId);
    const midIndex = ids.indexOf(mid.body.employeeId);
    const highIndex = ids.indexOf(high.body.employeeId);
    expect(highIndex).toBeLessThan(midIndex);
    expect(midIndex).toBeLessThan(lowIndex);
  });
});

describe("GET /employees — currentProjectNames (EPIC-0006, US3)", () => {
  let testDb: TestDb;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    testDb = await createTestDb();
    app = createApp(testDb.db);
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  it("shows the real current project name for a single current assignment", async () => {
    const { projectId, roleId, projectName } = await setupActiveProjectWithRole(app);
    const employee = await request(app).post("/employees").send({
      name: "Single Current Project",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    await request(app).post("/assignments").send({
      employeeId: employee.body.employeeId,
      projectId,
      roleId,
      capacityPercent: 50,
      startDate: todayIso(),
      endDate: todayIso(),
    });

    const res = await request(app).get("/employees").send();
    const entry = res.body.find(
      (e: { employeeId: string }) => e.employeeId === employee.body.employeeId,
    );
    expect(entry.currentProjectNames).toEqual([projectName]);
  });

  it("includes both project names for two concurrent current assignments to different projects", async () => {
    const projectA = await setupActiveProjectWithRole(app, "Engineer A");
    const projectB = await setupActiveProjectWithRole(app, "Engineer B");
    const employee = await request(app).post("/employees").send({
      name: "Two Current Projects",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    await request(app).post("/assignments").send({
      employeeId: employee.body.employeeId,
      projectId: projectA.projectId,
      roleId: projectA.roleId,
      capacityPercent: 30,
      startDate: todayIso(),
      endDate: todayIso(),
    });
    await request(app).post("/assignments").send({
      employeeId: employee.body.employeeId,
      projectId: projectB.projectId,
      roleId: projectB.roleId,
      capacityPercent: 30,
      startDate: todayIso(),
      endDate: todayIso(),
    });

    const res = await request(app).get("/employees").send();
    const entry = res.body.find(
      (e: { employeeId: string }) => e.employeeId === employee.body.employeeId,
    );
    expect(entry.currentProjectNames.sort()).toEqual(
      [projectA.projectName, projectB.projectName].sort(),
    );
  });

  it("de-duplicates when two current assignments share the same project (different roles)", async () => {
    const { projectId, projectName } = await setupActiveProjectWithRole(app, "Role One");
    const roleTwo = await request(app)
      .post(`/projects/${projectId}/roles`)
      .send({ name: "Role Two", capacityPercent: 100 });
    const rolesRes = await request(app).get(`/projects/${projectId}`).send();
    const roleOneId = rolesRes.body.requiredRoles.find(
      (r: { name: string }) => r.name === "Role One",
    ).roleId;

    const employee = await request(app).post("/employees").send({
      name: "Same Project Two Roles",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    await request(app).post("/assignments").send({
      employeeId: employee.body.employeeId,
      projectId,
      roleId: roleOneId,
      capacityPercent: 20,
      startDate: todayIso(),
      endDate: todayIso(),
    });
    await request(app).post("/assignments").send({
      employeeId: employee.body.employeeId,
      projectId,
      roleId: roleTwo.body.roleId,
      capacityPercent: 20,
      startDate: todayIso(),
      endDate: todayIso(),
    });

    const res = await request(app).get("/employees").send();
    const entry = res.body.find(
      (e: { employeeId: string }) => e.employeeId === employee.body.employeeId,
    );
    expect(entry.currentProjectNames).toEqual([projectName]);
  });

  it("returns an empty array for an employee with only past or only future assignments", async () => {
    const { projectId, roleId } = await setupActiveProjectWithRole(app);
    const employee = await request(app).post("/employees").send({
      name: "No Current Assignment",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    await request(app)
      .post("/assignments")
      .send({
        employeeId: employee.body.employeeId,
        projectId,
        roleId,
        capacityPercent: 20,
        startDate: addDays(todayIso(), 30),
        endDate: addDays(todayIso(), 40),
      });

    const res = await request(app).get("/employees").send();
    const entry = res.body.find(
      (e: { employeeId: string }) => e.employeeId === employee.body.employeeId,
    );
    expect(entry.currentProjectNames).toEqual([]);
  });

  it("returns an empty array for a never-staffed employee", async () => {
    const employee = await request(app).post("/employees").send({
      name: "Never Staffed CurrentProjectNames",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });

    const res = await request(app).get("/employees").send();
    const entry = res.body.find(
      (e: { employeeId: string }) => e.employeeId === employee.body.employeeId,
    );
    expect(entry.currentProjectNames).toEqual([]);
  });
});

describe("GET /employees — existing filter/sort parameter backfill (EPIC-0006, US4/SC-004)", () => {
  let testDb: TestDb;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    testDb = await createTestDb();
    app = createApp(testDb.db);
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  it("filters by skill", async () => {
    const skill = await request(app)
      .post("/skills")
      .send({ name: `Elixir-${Math.random()}` });
    const withSkill = await request(app).post("/employees").send({
      name: "Has Skill",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    const withoutSkill = await request(app).post("/employees").send({
      name: "No Skill",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    await request(app)
      .post(`/employees/${withSkill.body.employeeId}/skills`)
      .send({ skillId: skill.body.skillId, proficiency: "Expert" });

    const res = await request(app)
      .get(`/employees?skill=${encodeURIComponent(skill.body.name)}`)
      .send();
    const ids = res.body.map((e: { employeeId: string }) => e.employeeId);
    expect(ids).toContain(withSkill.body.employeeId);
    expect(ids).not.toContain(withoutSkill.body.employeeId);
  });

  it("filters by proficiency (combined with skill)", async () => {
    const skill = await request(app)
      .post("/skills")
      .send({ name: `Haskell-${Math.random()}` });
    const expert = await request(app).post("/employees").send({
      name: "Expert Haskell",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    const beginner = await request(app).post("/employees").send({
      name: "Beginner Haskell",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    await request(app)
      .post(`/employees/${expert.body.employeeId}/skills`)
      .send({ skillId: skill.body.skillId, proficiency: "Expert" });
    await request(app)
      .post(`/employees/${beginner.body.employeeId}/skills`)
      .send({ skillId: skill.body.skillId, proficiency: "Beginner" });

    const res = await request(app)
      .get(`/employees?skill=${encodeURIComponent(skill.body.name)}&proficiency=Expert`)
      .send();
    const ids = res.body.map((e: { employeeId: string }) => e.employeeId);
    expect(ids).toContain(expert.body.employeeId);
    expect(ids).not.toContain(beginner.body.employeeId);
  });

  it("filters by seniority", async () => {
    const juniorMarker = `Junior-${Math.random()}`;
    const junior = await request(app).post("/employees").send({
      name: juniorMarker,
      employmentStartDate: "2024-01-01",
      seniority: "Junior",
    });
    const senior = await request(app)
      .post("/employees")
      .send({
        name: `Senior-${Math.random()}`,
        employmentStartDate: "2024-01-01",
        seniority: "Senior",
      });

    const res = await request(app).get("/employees?seniority=Junior").send();
    const ids = res.body.map((e: { employeeId: string }) => e.employeeId);
    expect(ids).toContain(junior.body.employeeId);
    expect(ids).not.toContain(senior.body.employeeId);
  });

  it("sorts by name and by employmentStartDate", async () => {
    const a = await request(app)
      .post("/employees")
      .send({
        name: `AAA-${Math.random()}`,
        employmentStartDate: "2024-06-01",
        seniority: "Senior",
      });
    const b = await request(app)
      .post("/employees")
      .send({
        name: `ZZZ-${Math.random()}`,
        employmentStartDate: "2024-01-01",
        seniority: "Senior",
      });

    const byNameAsc = await request(app).get("/employees?sort=name&order=asc").send();
    const namesAsc = byNameAsc.body.map((e: { employeeId: string }) => e.employeeId);
    expect(namesAsc.indexOf(a.body.employeeId)).toBeLessThan(namesAsc.indexOf(b.body.employeeId));

    const byStartDateAsc = await request(app)
      .get("/employees?sort=employmentStartDate&order=asc")
      .send();
    const datesAsc = byStartDateAsc.body.map((e: { employeeId: string }) => e.employeeId);
    expect(datesAsc.indexOf(b.body.employeeId)).toBeLessThan(datesAsc.indexOf(a.body.employeeId));
  });
});
