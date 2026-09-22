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
});
