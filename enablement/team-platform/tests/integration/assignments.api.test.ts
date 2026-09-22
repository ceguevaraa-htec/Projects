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
    name: "Platform Revamp",
    startDate: "2024-01-01",
    endDate: "2024-12-31",
  });
  await request(app).patch(`/projects/${project.body.projectId}`).send({ status: "Active" });
  const role = await request(app)
    .post(`/projects/${project.body.projectId}/roles`)
    .send({ name: "Engineer", capacityPercent: 100 });
  return { projectId: project.body.projectId as string, roleId: role.body.roleId as string };
}

describe("Assignments API (integration)", () => {
  let testDb: TestDb;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    testDb = await createTestDb();
    app = createApp(testDb.db);
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  it("creates an assignment and rejects capacity-exceeded and non-Active-project attempts (FR-0013–FR-0015)", async () => {
    const employee = await request(app).post("/employees").send({
      name: "Ada Lovelace",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    const { projectId, roleId } = await setupActiveProjectWithRole(app);

    const created = await request(app)
      .post("/assignments")
      .send({
        employeeId: employee.body.employeeId,
        projectId,
        roleId,
        capacityPercent: 60,
        startDate: addDays(todayIso(), 1),
        endDate: addDays(todayIso(), 10),
      });
    expect(created.status).toBe(201);
    expect(created.body.temporalStatus).toBe("future");

    const capacityExceeded = await request(app)
      .post("/assignments")
      .send({
        employeeId: employee.body.employeeId,
        projectId,
        roleId,
        capacityPercent: 50,
        startDate: addDays(todayIso(), 5),
        endDate: addDays(todayIso(), 15),
      });
    expect(capacityExceeded.status).toBe(409);
    expect(capacityExceeded.body.error_code).toBe("CAPACITY_EXCEEDED");

    const draftProject = await request(app).post("/projects").send({
      name: "Draft Project",
      startDate: "2024-01-01",
      endDate: "2024-12-31",
    });
    const draftRole = await request(app)
      .post(`/projects/${draftProject.body.projectId}/roles`)
      .send({ name: "Engineer", capacityPercent: 100 });
    const notActive = await request(app)
      .post("/assignments")
      .send({
        employeeId: employee.body.employeeId,
        projectId: draftProject.body.projectId,
        roleId: draftRole.body.roleId,
        capacityPercent: 50,
        startDate: addDays(todayIso(), 1),
        endDate: addDays(todayIso(), 10),
      });
    expect(notActive.status).toBe(409);
    expect(notActive.body.error_code).toBe("PROJECT_NOT_ACTIVE");
  });

  it("edits and cancels a future-dated assignment; rejects both for past-dated ones (FR-0016/FR-0017)", async () => {
    const employee = await request(app).post("/employees").send({
      name: "Grace Hopper",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    const { projectId, roleId } = await setupActiveProjectWithRole(app);

    const created = await request(app)
      .post("/assignments")
      .send({
        employeeId: employee.body.employeeId,
        projectId,
        roleId,
        capacityPercent: 50,
        startDate: addDays(todayIso(), 1),
        endDate: addDays(todayIso(), 10),
      });
    const assignmentId = created.body.assignmentId as string;

    const edited = await request(app)
      .patch(`/assignments/${assignmentId}`)
      .send({ capacityPercent: 70 });
    expect(edited.status).toBe(200);
    expect(edited.body.capacityPercent).toBe(70);

    const cancelled = await request(app).delete(`/assignments/${assignmentId}`).send();
    expect(cancelled.status).toBe(204);

    // Seed a past-dated assignment via a normal POST — creation has no future-only
    // restriction (only edit/cancel do, per FR-0016/FR-0017; see data-model.md).
    const pastAssignment = await request(app)
      .post("/assignments")
      .send({
        employeeId: employee.body.employeeId,
        projectId,
        roleId,
        capacityPercent: 40,
        startDate: addDays(todayIso(), -10),
        endDate: addDays(todayIso(), -1),
      });
    expect(pastAssignment.status).toBe(201);
    const pastId = pastAssignment.body.assignmentId as string;

    const editRejected = await request(app)
      .patch(`/assignments/${pastId}`)
      .send({ capacityPercent: 50 });
    expect(editRejected.status).toBe(409);
    expect(editRejected.body.error_code).toBe("ASSIGNMENT_NOT_EDITABLE");

    const cancelRejected = await request(app).delete(`/assignments/${pastId}`).send();
    expect(cancelRejected.status).toBe(409);
    expect(cancelRejected.body.error_code).toBe("ASSIGNMENT_NOT_CANCELLABLE");
  });

  it("returns 404 AssignmentNotFoundError for GET/PATCH/DELETE on a nonexistent id", async () => {
    const getRes = await request(app).get("/assignments/does-not-exist").send();
    expect(getRes.status).toBe(404);
    expect(getRes.body.error_code).toBe("NOT_FOUND");

    const patchRes = await request(app)
      .patch("/assignments/does-not-exist")
      .send({ capacityPercent: 50 });
    expect(patchRes.status).toBe(404);

    const deleteRes = await request(app).delete("/assignments/does-not-exist").send();
    expect(deleteRes.status).toBe(404);
  });

  it("lists candidates with an accurate, non-filtering skill-match tier (FR-0018)", async () => {
    const skill = await request(app).post("/skills").send({ name: "Kubernetes" });
    const { projectId } = await setupActiveProjectWithRole(app);
    const roleWithSkill = await request(app)
      .post(`/projects/${projectId}/roles`)
      .send({ name: "SRE", capacityPercent: 100, requiredSkillIds: [skill.body.skillId] });

    const strongCandidate = await request(app).post("/employees").send({
      name: "Strong Candidate",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    await request(app)
      .post(`/employees/${strongCandidate.body.employeeId}/skills`)
      .send({ skillId: skill.body.skillId, proficiency: "Expert" });

    const noMatchCandidate = await request(app).post("/employees").send({
      name: "No Match Candidate",
      employmentStartDate: "2024-01-01",
      seniority: "Junior",
    });

    const candidates = await request(app)
      .get(`/projects/${projectId}/roles/${roleWithSkill.body.roleId}/candidates`)
      .send();
    expect(candidates.status).toBe(200);
    expect(Array.isArray(candidates.body)).toBe(true);
    expect(candidates.body.length).toBeGreaterThanOrEqual(2);

    const byId = new Map(candidates.body.map((c: { employeeId: string }) => [c.employeeId, c]));
    expect((byId.get(strongCandidate.body.employeeId) as { matchTier: string }).matchTier).toBe(
      "strong",
    );
    expect((byId.get(noMatchCandidate.body.employeeId) as { matchTier: string }).matchTier).toBe(
      "no_match",
    );
  });
});
