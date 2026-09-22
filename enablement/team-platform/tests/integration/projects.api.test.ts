import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/api/app.js";
import { createTestDb, type TestDb } from "../helpers/db.js";

describe("Projects API (integration)", () => {
  let testDb: TestDb;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    testDb = await createTestDb();
    app = createApp(testDb.db);
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  it("creates, transitions, edits, and deletes a project (FR-0009, FR-0012)", async () => {
    const created = await request(app).post("/projects").send({
      name: "Platform Revamp",
      startDate: "2024-01-01",
      endDate: "2024-12-01",
    });
    expect(created.status).toBe(201);
    expect(created.body.status).toBe("Draft");
    const projectId = created.body.projectId as string;

    const activated = await request(app).patch(`/projects/${projectId}`).send({ status: "Active" });
    expect(activated.status).toBe(200);
    expect(activated.body.status).toBe("Active");

    const completed = await request(app)
      .patch(`/projects/${projectId}`)
      .send({ status: "Completed" });
    expect(completed.status).toBe(200);

    const invalidTransition = await request(app)
      .patch(`/projects/${projectId}`)
      .send({ status: "Active" });
    expect(invalidTransition.status).toBe(409);
    expect(invalidTransition.body.error_code).toBe("INVALID_STATUS_TRANSITION");

    const deleted = await request(app).delete(`/projects/${projectId}`).send();
    expect(deleted.status).toBe(204);

    const afterDelete = await request(app).get(`/projects/${projectId}`).send();
    expect(afterDelete.status).toBe(404);
    expect(afterDelete.body.error_code).toBe("NOT_FOUND");
  });

  it("returns 404 ProjectNotFoundError for GET/PATCH/DELETE on a nonexistent id", async () => {
    const getRes = await request(app).get("/projects/does-not-exist").send();
    expect(getRes.status).toBe(404);
    expect(getRes.body.error_code).toBe("NOT_FOUND");

    const patchRes = await request(app).patch("/projects/does-not-exist").send({ name: "X" });
    expect(patchRes.status).toBe(404);
    expect(patchRes.body.error_code).toBe("NOT_FOUND");

    const deleteRes = await request(app).delete("/projects/does-not-exist").send();
    expect(deleteRes.status).toBe(404);
    expect(deleteRes.body.error_code).toBe("NOT_FOUND");
  });

  it("adds, edits, and removes a required role, with skill validation (FR-0010/FR-0011)", async () => {
    const project = await request(app).post("/projects").send({
      name: "Data Platform",
      startDate: "2024-01-01",
      endDate: "2024-12-01",
    });
    const projectId = project.body.projectId as string;
    const skill = await request(app).post("/skills").send({ name: "Kubernetes" });

    const invalidCapacity = await request(app)
      .post(`/projects/${projectId}/roles`)
      .send({ name: "SRE", capacityPercent: 0 });
    expect(invalidCapacity.status).toBe(400);
    expect(invalidCapacity.body.error_code).toBe("VALIDATION_ERROR");

    const missingSkill = await request(app)
      .post(`/projects/${projectId}/roles`)
      .send({ name: "SRE", capacityPercent: 50, requiredSkillIds: ["does-not-exist"] });
    expect(missingSkill.status).toBe(404);
    expect(missingSkill.body.error_code).toBe("NOT_FOUND");

    const created = await request(app)
      .post(`/projects/${projectId}/roles`)
      .send({ name: "SRE", capacityPercent: 50, requiredSkillIds: [skill.body.skillId] });
    expect(created.status).toBe(201);
    const roleId = created.body.roleId as string;

    const updated = await request(app)
      .patch(`/projects/${projectId}/roles/${roleId}`)
      .send({ capacityPercent: 75 });
    expect(updated.status).toBe(200);
    expect(updated.body.capacityPercent).toBe(75);

    const removed = await request(app).delete(`/projects/${projectId}/roles/${roleId}`).send();
    expect(removed.status).toBe(204);

    const afterRemoval = await request(app)
      .patch(`/projects/${projectId}/roles/${roleId}`)
      .send({ capacityPercent: 80 });
    expect(afterRemoval.status).toBe(404);
  });

  it("blocks role management once a project is Completed (PROJECT_NOT_EDITABLE)", async () => {
    const project = await request(app).post("/projects").send({
      name: "Finished Project",
      startDate: "2024-01-01",
      endDate: "2024-06-01",
    });
    const projectId = project.body.projectId as string;
    await request(app).patch(`/projects/${projectId}`).send({ status: "Active" });
    await request(app).patch(`/projects/${projectId}`).send({ status: "Completed" });

    const res = await request(app)
      .post(`/projects/${projectId}/roles`)
      .send({ name: "Late Addition", capacityPercent: 50 });
    expect(res.status).toBe(409);
    expect(res.body.error_code).toBe("PROJECT_NOT_EDITABLE");
  });

  it("blocks deleting a project or removing a role with a real assignment (EPIC-0003 discharge of T033)", async () => {
    const employee = await request(app).post("/employees").send({
      name: "Margaret Hamilton",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    const project = await request(app).post("/projects").send({
      name: "Onboard Guidance Software",
      startDate: "2024-01-01",
      endDate: "2024-12-31",
    });
    const projectId = project.body.projectId as string;
    await request(app).patch(`/projects/${projectId}`).send({ status: "Active" });
    const role = await request(app)
      .post(`/projects/${projectId}/roles`)
      .send({ name: "Software Engineer", capacityPercent: 100 });
    const roleId = role.body.roleId as string;

    const today = new Date().toISOString().slice(0, 10);
    await request(app).post("/assignments").send({
      employeeId: employee.body.employeeId,
      projectId,
      roleId,
      capacityPercent: 50,
      startDate: today,
      endDate: today,
    });

    const removeRoleRes = await request(app)
      .delete(`/projects/${projectId}/roles/${roleId}`)
      .send();
    expect(removeRoleRes.status).toBe(409);
    expect(removeRoleRes.body.error_code).toBe("ROLE_HAS_ASSIGNMENTS");

    const deleteProjectRes = await request(app).delete(`/projects/${projectId}`).send();
    expect(deleteProjectRes.status).toBe(409);
    expect(deleteProjectRes.body.error_code).toBe("PROJECT_HAS_ASSIGNMENTS");
  });
});

describe("GET /projects — existing filter/sort parameter backfill (EPIC-0006, US4/SC-004)", () => {
  let testDb: TestDb;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    testDb = await createTestDb();
    app = createApp(testDb.db);
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  it("filters by status", async () => {
    const draft = await request(app)
      .post("/projects")
      .send({
        name: `Draft Project ${Math.random()}`,
        startDate: "2024-01-01",
        endDate: "2024-12-31",
      });
    const active = await request(app)
      .post("/projects")
      .send({
        name: `Active Project ${Math.random()}`,
        startDate: "2024-01-01",
        endDate: "2024-12-31",
      });
    await request(app).patch(`/projects/${active.body.projectId}`).send({ status: "Active" });

    const res = await request(app).get("/projects?status=Active").send();
    const ids = res.body.map((p: { projectId: string }) => p.projectId);
    expect(ids).toContain(active.body.projectId);
    expect(ids).not.toContain(draft.body.projectId);
  });

  it("filters by requiredRole", async () => {
    const roleName = `Backend Engineer ${Math.random()}`;
    const withRole = await request(app)
      .post("/projects")
      .send({
        name: `With Role ${Math.random()}`,
        startDate: "2024-01-01",
        endDate: "2024-12-31",
      });
    const withoutRole = await request(app)
      .post("/projects")
      .send({
        name: `Without Role ${Math.random()}`,
        startDate: "2024-01-01",
        endDate: "2024-12-31",
      });
    await request(app)
      .post(`/projects/${withRole.body.projectId}/roles`)
      .send({ name: roleName, capacityPercent: 100 });

    const res = await request(app)
      .get(`/projects?requiredRole=${encodeURIComponent(roleName)}`)
      .send();
    const ids = res.body.map((p: { projectId: string }) => p.projectId);
    expect(ids).toContain(withRole.body.projectId);
    expect(ids).not.toContain(withoutRole.body.projectId);
  });

  it("filters by startDateFrom/startDateTo (date range)", async () => {
    const early = await request(app)
      .post("/projects")
      .send({
        name: `Early Start ${Math.random()}`,
        startDate: "2020-01-01",
        endDate: "2020-12-31",
      });
    const inRange = await request(app)
      .post("/projects")
      .send({
        name: `In Range ${Math.random()}`,
        startDate: "2025-06-01",
        endDate: "2025-12-31",
      });
    const late = await request(app)
      .post("/projects")
      .send({
        name: `Late Start ${Math.random()}`,
        startDate: "2030-01-01",
        endDate: "2030-12-31",
      });

    const res = await request(app)
      .get("/projects?startDateFrom=2025-01-01&startDateTo=2025-12-31")
      .send();
    const ids = res.body.map((p: { projectId: string }) => p.projectId);
    expect(ids).toContain(inRange.body.projectId);
    expect(ids).not.toContain(early.body.projectId);
    expect(ids).not.toContain(late.body.projectId);
  });

  it("sorts by name, startDate, and endDate", async () => {
    const a = await request(app)
      .post("/projects")
      .send({
        name: `AAA-${Math.random()}`,
        startDate: "2024-06-01",
        endDate: "2024-12-01",
      });
    const b = await request(app)
      .post("/projects")
      .send({
        name: `ZZZ-${Math.random()}`,
        startDate: "2024-01-01",
        endDate: "2024-03-01",
      });

    const byNameAsc = await request(app).get("/projects?sort=name&order=asc").send();
    const namesAsc = byNameAsc.body.map((p: { projectId: string }) => p.projectId);
    expect(namesAsc.indexOf(a.body.projectId)).toBeLessThan(namesAsc.indexOf(b.body.projectId));

    const byStartDateAsc = await request(app).get("/projects?sort=startDate&order=asc").send();
    const startsAsc = byStartDateAsc.body.map((p: { projectId: string }) => p.projectId);
    expect(startsAsc.indexOf(b.body.projectId)).toBeLessThan(startsAsc.indexOf(a.body.projectId));

    const byEndDateAsc = await request(app).get("/projects?sort=endDate&order=asc").send();
    const endsAsc = byEndDateAsc.body.map((p: { projectId: string }) => p.projectId);
    expect(endsAsc.indexOf(b.body.projectId)).toBeLessThan(endsAsc.indexOf(a.body.projectId));
  });
});
