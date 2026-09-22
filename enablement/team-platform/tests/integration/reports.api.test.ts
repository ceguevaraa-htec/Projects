import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/api/app.js";
import { createTestDb, type TestDb } from "../helpers/db.js";

describe("Reports API (integration)", () => {
  let testDb: TestDb;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    testDb = await createTestDb();
    app = createApp(testDb.db);
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  it("GET /reports/org returns a valid PDF, even with no employees (edge case)", async () => {
    const res = await request(app).get("/reports/org").send();
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    expect(res.body.length).toBeGreaterThan(0);
  });

  it("GET /reports/employees/{employeeId} returns a valid PDF for an existing employee", async () => {
    const employee = await request(app).post("/employees").send({
      name: "Report Test Employee",
      employmentStartDate: "2024-01-01",
      seniority: "Mid",
    });

    const res = await request(app).get(`/reports/employees/${employee.body.employeeId}`).send();
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    expect(res.body.length).toBeGreaterThan(0);
  });

  it("GET /reports/employees/{employeeId} returns 404 NOT_FOUND for a nonexistent employee", async () => {
    const res = await request(app).get("/reports/employees/does-not-exist").send();
    expect(res.status).toBe(404);
    expect(res.body.error_code).toBe("NOT_FOUND");
  });

  it("GET /reports/projects/{projectId} returns a valid PDF for an existing project", async () => {
    const project = await request(app).post("/projects").send({
      name: "Report Test Project",
      startDate: "2024-01-01",
      endDate: "2024-12-31",
    });

    const res = await request(app).get(`/reports/projects/${project.body.projectId}`).send();
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    expect(res.body.length).toBeGreaterThan(0);
  });

  it("GET /reports/projects/{projectId} returns 404 NOT_FOUND for a nonexistent project", async () => {
    const res = await request(app).get("/reports/projects/does-not-exist").send();
    expect(res.status).toBe(404);
    expect(res.body.error_code).toBe("NOT_FOUND");
  });
});
