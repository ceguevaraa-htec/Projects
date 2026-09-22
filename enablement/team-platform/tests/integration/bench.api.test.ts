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
    name: "Bench Test Project",
    startDate: "2024-01-01",
    endDate: "2024-12-31",
  });
  await request(app).patch(`/projects/${project.body.projectId}`).send({ status: "Active" });
  const role = await request(app)
    .post(`/projects/${project.body.projectId}/roles`)
    .send({ name: "Engineer", capacityPercent: 100 });
  return { projectId: project.body.projectId as string, roleId: role.body.roleId as string };
}

describe("Bench API (integration)", () => {
  let testDb: TestDb;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    testDb = await createTestDb();
    app = createApp(testDb.db);
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  it("returns 400 VALIDATION_ERROR for a missing window parameter", async () => {
    const res = await request(app).get("/bench").send();
    expect(res.status).toBe(400);
    expect(res.body.error_code).toBe("VALIDATION_ERROR");
  });

  it("excludes a fully-booked employee and includes a partially-booked one for window=now", async () => {
    const { projectId, roleId } = await setupActiveProjectWithRole(app);

    const fullyBooked = await request(app).post("/employees").send({
      name: "Fully Booked",
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

    const partiallyBooked = await request(app).post("/employees").send({
      name: "Partially Booked",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    await request(app).post("/assignments").send({
      employeeId: partiallyBooked.body.employeeId,
      projectId,
      roleId,
      capacityPercent: 35,
      startDate: todayIso(),
      endDate: todayIso(),
    });

    const bench = await request(app).get("/bench?window=now").send();
    expect(bench.status).toBe(200);
    const byId = new Map(bench.body.map((e: { employeeId: string }) => [e.employeeId, e]));
    expect(byId.has(fullyBooked.body.employeeId)).toBe(false);
    expect(
      (byId.get(partiallyBooked.body.employeeId) as { utilizationPercent: number })
        ?.utilizationPercent,
    ).toBe(35);
  });

  it("includes an employee busy-then-free within a 30-day window (resolved ambiguity)", async () => {
    const { projectId, roleId } = await setupActiveProjectWithRole(app);
    const employee = await request(app).post("/employees").send({
      name: "Busy Then Free",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    await request(app)
      .post("/assignments")
      .send({
        employeeId: employee.body.employeeId,
        projectId,
        roleId,
        capacityPercent: 100,
        startDate: todayIso(),
        endDate: addDays(todayIso(), 5),
      });

    const bench = await request(app).get("/bench?window=30d").send();
    const entry = bench.body.find(
      (e: { employeeId: string }) => e.employeeId === employee.body.employeeId,
    );
    expect(entry).toBeDefined();
    expect(entry.utilizationPercent).toBe(0);
  });

  it("includes an employee with two non-overlapping partial assignments within a 90-day window (resolved ambiguity)", async () => {
    const { projectId, roleId } = await setupActiveProjectWithRole(app);
    const employee = await request(app).post("/employees").send({
      name: "Two Non-Overlapping Partials",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    await request(app)
      .post("/assignments")
      .send({
        employeeId: employee.body.employeeId,
        projectId,
        roleId,
        capacityPercent: 50,
        startDate: addDays(todayIso(), 1),
        endDate: addDays(todayIso(), 10),
      });
    await request(app)
      .post("/assignments")
      .send({
        employeeId: employee.body.employeeId,
        projectId,
        roleId,
        capacityPercent: 50,
        startDate: addDays(todayIso(), 60),
        endDate: addDays(todayIso(), 70),
      });

    const bench = await request(app).get("/bench?window=90d").send();
    const entry = bench.body.find(
      (e: { employeeId: string }) => e.employeeId === employee.body.employeeId,
    );
    expect(entry).toBeDefined();
    expect(entry.utilizationPercent).toBe(0);
  });
});
