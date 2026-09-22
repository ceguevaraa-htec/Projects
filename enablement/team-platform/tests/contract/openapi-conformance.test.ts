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

  it("POST /projects returns 201 with the Project schema shape", async () => {
    const res = await request(app).post("/projects").send({
      name: "Modernization",
      startDate: "2024-01-01",
      endDate: "2024-12-01",
    });
    expect(res.status).toBe(201);
    expect(Object.keys(res.body).sort()).toEqual(
      ["projectId", "name", "status", "startDate", "endDate"].sort(),
    );
  });

  it("GET /projects returns 200 with an array of ProjectSummary shapes", async () => {
    const res = await request(app).get("/projects").send();
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length > 0) {
      expect(Object.keys(res.body[0]).sort()).toEqual(
        ["projectId", "name", "status", "startDate", "endDate", "requiredRoleCount"].sort(),
      );
    }
  });

  it("GET /projects/{projectId} returns 200 with the Project schema shape (embedded requiredRoles)", async () => {
    const created = await request(app).post("/projects").send({
      name: "Observability Rollout",
      startDate: "2024-01-01",
      endDate: "2024-12-01",
    });
    const res = await request(app).get(`/projects/${created.body.projectId}`).send();
    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(
      ["projectId", "name", "status", "startDate", "endDate", "requiredRoles"].sort(),
    );
  });

  it("POST/PATCH /projects/{projectId}/roles return 201/200 with the ProjectRole schema shape", async () => {
    const project = await request(app).post("/projects").send({
      name: "Search Revamp",
      startDate: "2024-01-01",
      endDate: "2024-12-01",
    });
    const projectId = project.body.projectId as string;

    const created = await request(app)
      .post(`/projects/${projectId}/roles`)
      .send({ name: "Search Engineer", capacityPercent: 60 });
    expect(created.status).toBe(201);
    expect(Object.keys(created.body).sort()).toEqual(
      ["roleId", "name", "capacityPercent", "requiredSkills"].sort(),
    );

    const updated = await request(app)
      .patch(`/projects/${projectId}/roles/${created.body.roleId}`)
      .send({ capacityPercent: 80 });
    expect(updated.status).toBe(200);
    expect(Object.keys(updated.body).sort()).toEqual(
      ["roleId", "name", "capacityPercent", "requiredSkills"].sort(),
    );
  });

  it("role management on a Completed project returns 409 with error_code PROJECT_NOT_EDITABLE (SC-005)", async () => {
    const project = await request(app).post("/projects").send({
      name: "Wrapped Up",
      startDate: "2024-01-01",
      endDate: "2024-06-01",
    });
    const projectId = project.body.projectId as string;
    await request(app).patch(`/projects/${projectId}`).send({ status: "Active" });
    await request(app).patch(`/projects/${projectId}`).send({ status: "Completed" });

    const res = await request(app)
      .post(`/projects/${projectId}/roles`)
      .send({ name: "Too Late", capacityPercent: 50 });
    expect(res.status).toBe(409);
    expect(Object.keys(res.body).sort()).toEqual(["error_code", "message"].sort());
    expect(res.body.error_code).toBe("PROJECT_NOT_EDITABLE");
  });
});

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function todayIso(): string {
  return addDays(new Date().toISOString().slice(0, 10), 0);
}

describe("OpenAPI conformance — Assignment Engine endpoints", () => {
  let testDb: TestDb;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    testDb = await createTestDb();
    app = createApp(testDb.db);
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  async function setupActiveProjectWithRole() {
    const project = await request(app).post("/projects").send({
      name: "Contract Test Project",
      startDate: "2024-01-01",
      endDate: "2024-12-31",
    });
    await request(app).patch(`/projects/${project.body.projectId}`).send({ status: "Active" });
    const role = await request(app)
      .post(`/projects/${project.body.projectId}/roles`)
      .send({ name: "Engineer", capacityPercent: 100 });
    return { projectId: project.body.projectId as string, roleId: role.body.roleId as string };
  }

  it("POST /assignments and GET /assignments/{assignmentId} return the Assignment schema shape", async () => {
    const employee = await request(app).post("/employees").send({
      name: "Contract Test Employee",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    const { projectId, roleId } = await setupActiveProjectWithRole();

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
    expect(created.status).toBe(201);
    expect(Object.keys(created.body).sort()).toEqual(
      [
        "assignmentId",
        "employeeId",
        "employeeName",
        "projectId",
        "projectName",
        "roleId",
        "roleName",
        "capacityPercent",
        "startDate",
        "endDate",
        "temporalStatus",
      ].sort(),
    );

    const fetched = await request(app).get(`/assignments/${created.body.assignmentId}`).send();
    expect(fetched.status).toBe(200);
    expect(Object.keys(fetched.body).sort()).toEqual(Object.keys(created.body).sort());
  });

  it("PATCH /assignments/{assignmentId} on a past-dated assignment returns 409 ASSIGNMENT_NOT_EDITABLE with the ErrorResponse shape", async () => {
    const employee = await request(app).post("/employees").send({
      name: "Past Assignment Employee",
      employmentStartDate: "2024-01-01",
      seniority: "Senior",
    });
    const { projectId, roleId } = await setupActiveProjectWithRole();

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

    const res = await request(app)
      .patch(`/assignments/${pastAssignment.body.assignmentId}`)
      .send({ capacityPercent: 50 });
    expect(res.status).toBe(409);
    expect(Object.keys(res.body).sort()).toEqual(["error_code", "message"].sort());
    expect(res.body.error_code).toBe("ASSIGNMENT_NOT_EDITABLE");
  });

  it("GET /projects/{projectId}/roles/{roleId}/candidates returns an array of CandidateEmployee shapes", async () => {
    const { projectId, roleId } = await setupActiveProjectWithRole();
    await request(app).post("/employees").send({
      name: "Candidate Shape Check",
      employmentStartDate: "2024-01-01",
      seniority: "Mid",
    });

    const res = await request(app).get(`/projects/${projectId}/roles/${roleId}/candidates`).send();
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(Object.keys(res.body[0]).sort()).toEqual(
      ["employeeId", "name", "seniority", "currentUtilizationPercent", "matchTier"].sort(),
    );
  });
});
