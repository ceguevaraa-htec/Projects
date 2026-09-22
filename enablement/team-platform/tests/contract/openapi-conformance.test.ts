import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/api/app.js";
import { createTestDb, type TestDb } from "../helpers/db.js";

/**
 * Asserts this epic's endpoints match specs/contracts/openapi-spec.yaml exactly: status codes
 * and the field set of each schema (Employee, EmployeeSummary, EmployeeSkill, Skill,
 * SkillDeletionImpact, ErrorResponse). Per constitution Principle I, the OpenAPI spec is
 * authoritative — this test does not re-derive shapes, only checks conformance to them.
 */
describe("OpenAPI conformance — Employee Management endpoints", () => {
  let testDb: TestDb;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    testDb = await createTestDb();
    app = createApp(testDb.db);
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  it("POST /employees returns 201 with the Employee schema shape", async () => {
    const res = await request(app).post("/employees").send({
      name: "Shafi Goldwasser",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    expect(res.status).toBe(201);
    expect(Object.keys(res.body).sort()).toEqual(
      [
        "employeeId",
        "employmentEndDate",
        "employmentStartDate",
        "name",
        "seniority",
        "currentUtilizationPercent",
        "skills",
        "assignments",
      ].sort(),
    );
  });

  it("GET /employees returns 200 with an array of EmployeeSummary shapes", async () => {
    const res = await request(app).get("/employees").send();
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length > 0) {
      expect(Object.keys(res.body[0]).sort()).toEqual(
        [
          "currentProjectNames",
          "currentUtilizationPercent",
          "employeeId",
          "name",
          "seniority",
        ].sort(),
      );
    }
  });

  it("GET /employees/{employeeId} returns 200 with the Employee schema shape (embedded skills/assignments)", async () => {
    const created = await request(app).post("/employees").send({
      name: "Frances Allen",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    const res = await request(app).get(`/employees/${created.body.employeeId}`).send();
    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(
      [
        "employeeId",
        "name",
        "employmentStartDate",
        "employmentEndDate",
        "seniority",
        "currentUtilizationPercent",
        "skills",
        "assignments",
      ].sort(),
    );
  });

  it("PATCH /employees/{employeeId}/skills/{skillId} and POST return 200/201 with the EmployeeSkill schema shape", async () => {
    const employee = await request(app).post("/employees").send({
      name: "Karen Sparck Jones",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    const skill = await request(app).post("/skills").send({ name: "NLP" });

    const created = await request(app)
      .post(`/employees/${employee.body.employeeId}/skills`)
      .send({ skillId: skill.body.skillId, proficiency: "Expert" });
    expect(created.status).toBe(201);
    expect(Object.keys(created.body).sort()).toEqual(
      ["skillId", "skillName", "proficiency"].sort(),
    );

    const updated = await request(app)
      .patch(`/employees/${employee.body.employeeId}/skills/${skill.body.skillId}`)
      .send({ proficiency: "Intermediate" });
    expect(updated.status).toBe(200);
    expect(Object.keys(updated.body).sort()).toEqual(
      ["skillId", "skillName", "proficiency"].sort(),
    );
  });

  it("POST/GET /skills return 201/200 with the Skill schema shape", async () => {
    const created = await request(app).post("/skills").send({ name: "Distributed Systems" });
    expect(created.status).toBe(201);
    expect(Object.keys(created.body).sort()).toEqual(["skillId", "name"].sort());

    const list = await request(app).get("/skills").send();
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body)).toBe(true);
  });

  it("GET /skills/{skillId}/deletion-impact returns 200 with the SkillDeletionImpact schema shape", async () => {
    const skill = await request(app).post("/skills").send({ name: "Compilers" });
    const res = await request(app).get(`/skills/${skill.body.skillId}/deletion-impact`).send();
    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(
      ["skillId", "affectedEmployeeCount", "affectedProjectRoleCount"].sort(),
    );
  });

  it("POST /skills with a colliding name returns 409 with the ErrorResponse shape", async () => {
    await request(app).post("/skills").send({ name: "Cryptography" });
    const res = await request(app).post("/skills").send({ name: "Cryptography" });
    expect(res.status).toBe(409);
    expect(Object.keys(res.body).sort()).toEqual(["error_code", "message"].sort());
    expect(res.body.error_code).toBe("SKILL_NAME_NOT_UNIQUE");
  });
});
