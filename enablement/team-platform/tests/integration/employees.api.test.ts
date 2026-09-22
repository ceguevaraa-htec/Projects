import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/api/app.js";
import { createTestDb, type TestDb } from "../helpers/db.js";

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
