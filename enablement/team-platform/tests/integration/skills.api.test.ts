import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/api/app.js";
import { createTestDb, type TestDb } from "../helpers/db.js";

describe("Skills API (integration)", () => {
  let testDb: TestDb;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    testDb = await createTestDb();
    app = createApp(testDb.db);
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  it("creates, renames, previews deletion-impact, and deletes a skill (FR-0006–FR-0008)", async () => {
    const created = await request(app).post("/skills").send({ name: "TypeScript" });
    expect(created.status).toBe(201);
    const skillId = created.body.skillId as string;

    const renamed = await request(app).patch(`/skills/${skillId}`).send({ name: "TypeScript 5" });
    expect(renamed.status).toBe(200);
    expect(renamed.body.name).toBe("TypeScript 5");

    const employee = await request(app).post("/employees").send({
      name: "Barbara Liskov",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    const employeeId = employee.body.employeeId as string;
    await request(app)
      .post(`/employees/${employeeId}/skills`)
      .send({ skillId, proficiency: "Expert" });

    const impact = await request(app).get(`/skills/${skillId}/deletion-impact`).send();
    expect(impact.status).toBe(200);
    expect(impact.body.affectedEmployeeCount).toBe(1);
    expect(impact.body.affectedProjectRoleCount).toBe(0);

    const deleted = await request(app).delete(`/skills/${skillId}`).send();
    expect(deleted.status).toBe(204);

    const employeeAfter = await request(app).get(`/employees/${employeeId}`).send();
    expect(employeeAfter.body.skills).toEqual([]);
  });

  it("rejects creating/renaming a skill with a colliding name (FR-0006/FR-0007)", async () => {
    await request(app).post("/skills").send({ name: "Elixir" });
    const collision = await request(app).post("/skills").send({ name: "Elixir" });
    expect(collision.status).toBe(409);
    expect(collision.body.error_code).toBe("SKILL_NAME_NOT_UNIQUE");
  });

  it("returns 404 SkillNotFoundError for GET/PATCH/deletion-impact/DELETE on a nonexistent id", async () => {
    const patchRes = await request(app).patch("/skills/does-not-exist").send({ name: "X" });
    expect(patchRes.status).toBe(404);
    expect(patchRes.body.error_code).toBe("NOT_FOUND");

    const impactRes = await request(app).get("/skills/does-not-exist/deletion-impact").send();
    expect(impactRes.status).toBe(404);
    expect(impactRes.body.error_code).toBe("NOT_FOUND");

    const deleteRes = await request(app).delete("/skills/does-not-exist").send();
    expect(deleteRes.status).toBe(404);
    expect(deleteRes.body.error_code).toBe("NOT_FOUND");
  });
});
