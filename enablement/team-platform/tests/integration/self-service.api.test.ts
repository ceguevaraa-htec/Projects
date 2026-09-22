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

async function setupActiveProjectWithRole(app: ReturnType<typeof createApp>) {
  const project = await request(app).post("/projects").send({
    name: "Self-Service Test Project",
    startDate: "2024-01-01",
    endDate: "2024-12-31",
  });
  await request(app).patch(`/projects/${project.body.projectId}`).send({ status: "Active" });
  const role = await request(app)
    .post(`/projects/${project.body.projectId}/roles`)
    .send({ name: "Engineer", capacityPercent: 100 });
  return { projectId: project.body.projectId as string, roleId: role.body.roleId as string };
}

describe("Employee Self-Service API (integration)", () => {
  let testDb: TestDb;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    testDb = await createTestDb();
    app = createApp(testDb.db);
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  it("returns full assignment history (past, current, future) and current utilization %", async () => {
    const { projectId, roleId } = await setupActiveProjectWithRole(app);
    const employee = await request(app).post("/employees").send({
      name: "Grace Hopper",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });

    await request(app)
      .post("/assignments")
      .send({
        employeeId: employee.body.employeeId,
        projectId,
        roleId,
        capacityPercent: 40,
        startDate: addDays(todayIso(), -30),
        endDate: addDays(todayIso(), -20),
      });
    await request(app)
      .post("/assignments")
      .send({
        employeeId: employee.body.employeeId,
        projectId,
        roleId,
        capacityPercent: 60,
        startDate: todayIso(),
        endDate: addDays(todayIso(), 5),
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

    const res = await request(app)
      .get(`/employees/${employee.body.employeeId}/my-assignments`)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.employeeId).toBe(employee.body.employeeId);
    expect(res.body.name).toBe("Grace Hopper");
    expect(res.body.currentUtilizationPercent).toBe(60);
    expect(res.body.assignments).toHaveLength(3);
    const statuses = res.body.assignments.map((a: { temporalStatus: string }) => a.temporalStatus);
    expect(statuses.sort()).toEqual(["current", "future", "past"]);
  });

  it("returns 200 with an empty assignments list and 0% utilization for a never-staffed employee", async () => {
    const employee = await request(app).post("/employees").send({
      name: "Never Staffed",
      employmentStartDate: "2024-01-01",
      seniority: "Junior",
    });

    const res = await request(app)
      .get(`/employees/${employee.body.employeeId}/my-assignments`)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.assignments).toEqual([]);
    expect(res.body.currentUtilizationPercent).toBe(0);
  });

  it("returns 404 NOT_FOUND for a nonexistent employeeId", async () => {
    const res = await request(app).get("/employees/does-not-exist/my-assignments").send();

    expect(res.status).toBe(404);
    expect(res.body.error_code).toBe("NOT_FOUND");
  });

  it("never leaks another employee's data into the response", async () => {
    const { projectId, roleId } = await setupActiveProjectWithRole(app);

    const employeeA = await request(app).post("/employees").send({
      name: "Employee A",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    const employeeB = await request(app).post("/employees").send({
      name: "Employee B",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });

    await request(app)
      .post("/assignments")
      .send({
        employeeId: employeeA.body.employeeId,
        projectId,
        roleId,
        capacityPercent: 50,
        startDate: todayIso(),
        endDate: addDays(todayIso(), 5),
      });
    await request(app)
      .post("/assignments")
      .send({
        employeeId: employeeB.body.employeeId,
        projectId,
        roleId,
        capacityPercent: 70,
        startDate: todayIso(),
        endDate: addDays(todayIso(), 5),
      });

    const res = await request(app)
      .get(`/employees/${employeeA.body.employeeId}/my-assignments`)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.employeeId).toBe(employeeA.body.employeeId);
    expect(res.body.currentUtilizationPercent).toBe(50);
    expect(res.body.assignments).toHaveLength(1);
    const employeeIds = res.body.assignments.map((a: { employeeId: string }) => a.employeeId);
    expect(employeeIds).not.toContain(employeeB.body.employeeId);
    expect(JSON.stringify(res.body)).not.toContain(employeeB.body.employeeId);
    expect(JSON.stringify(res.body)).not.toContain("Employee B");
  });
});
