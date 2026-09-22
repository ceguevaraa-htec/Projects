import { Router } from "express";
import type { EmployeeService } from "../../domain/employee.service.js";
import type { AssignmentService } from "../../domain/assignment.service.js";
import type { SelfServiceService } from "../../domain/self-service.service.js";
import type { EmployeeListFilters, Proficiency, Seniority } from "../../domain/types.js";
import { asyncHandler } from "../async-handler.js";
import { ValidationError } from "../../domain/errors/domain-errors.js";

/**
 * Parses/validates the minAvailability query param (EPIC-0006). Absent → undefined (no filter).
 * Present but non-integer, negative, or >100 → ValidationError, matching capacityPercent's and
 * the bench window param's existing strict-validation precedent (research.md's revised decision
 * — NOT the lenient fallback `sort`/`order` use, which is unrelated pre-existing behavior).
 */
function parseMinAvailability(raw: unknown): number | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0 || value > 100) {
    throw new ValidationError("minAvailability must be an integer between 0 and 100.");
  }
  return value;
}

/**
 * Routes matching specs/contracts/openapi-spec.yaml's /employees paths exactly.
 *
 * As of EPIC-0003, `currentUtilizationPercent` and embedded `assignments` are computed via the
 * shared `AssignmentService.getCurrentUtilization`/`listEmployeeAssignments` — no longer
 * hardcoded to 0/[] as they were in EPIC-0001 (see that epic's data-model.md, now resolved).
 *
 * As of EPIC-0005, `/my-assignments` composes via `SelfServiceService`, not directly — the route
 * performs no composition or error construction itself (research.md's Principle II decision).
 *
 * As of EPIC-0006, `GET /` supports `minAvailability`/`sort=utilization` (both computed once in
 * `EmployeeService.listEmployees`, not recomputed here) and `currentProjectNames` is real data
 * (via `listEmployeeAssignments`, filtered to current, de-duplicated) — no longer hardcoded `[]`.
 */
export function createEmployeesRouter(
  service: EmployeeService,
  assignmentService: AssignmentService,
  selfServiceService: SelfServiceService,
): Router {
  const router = Router();

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      const employee = await service.createEmployee(req.body);
      // A freshly created employee cannot yet have any assignments (nothing can reference an
      // id that didn't exist until this call), so utilization/assignments are trivially empty
      // — no query needed here, unlike the read paths below.
      res
        .status(201)
        .json({ ...employee, currentUtilizationPercent: 0, skills: [], assignments: [] });
    }),
  );

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const filters: EmployeeListFilters = {
        skill: typeof req.query.skill === "string" ? req.query.skill : undefined,
        proficiency: req.query.proficiency as Proficiency | undefined,
        seniority: req.query.seniority as Seniority | undefined,
        minAvailability: parseMinAvailability(req.query.minAvailability),
        sort: req.query.sort as EmployeeListFilters["sort"],
        order: req.query.order as EmployeeListFilters["order"],
      };
      // EPIC-0006: listEmployees now returns utilization-annotated records (filtered by
      // minAvailability, sorted when sort=utilization) — no separate getCurrentUtilization call
      // needed here anymore (avoids computing it twice; see research.md's single-pass decision).
      const employees = await service.listEmployees(filters);

      const summaries = await Promise.all(
        employees.map(async (employee) => {
          const assignments = await assignmentService.listEmployeeAssignments(employee.employeeId);
          const currentProjectNames = [
            ...new Set(
              assignments.filter((a) => a.temporalStatus === "current").map((a) => a.projectName),
            ),
          ];
          return {
            employeeId: employee.employeeId,
            name: employee.name,
            seniority: employee.seniority,
            currentUtilizationPercent: employee.currentUtilizationPercent,
            currentProjectNames,
          };
        }),
      );
      res.status(200).json(summaries);
    }),
  );

  router.get(
    "/:employeeId",
    asyncHandler(async (req, res) => {
      const employee = await service.getEmployee(req.params.employeeId);
      const skills = await service.listEmployeeSkills(req.params.employeeId);
      const [currentUtilizationPercent, assignments] = await Promise.all([
        assignmentService.getCurrentUtilization(employee.employeeId),
        assignmentService.listEmployeeAssignments(employee.employeeId),
      ]);
      res.status(200).json({
        ...employee,
        currentUtilizationPercent,
        skills,
        assignments,
      });
    }),
  );

  router.get(
    "/:employeeId/my-assignments",
    asyncHandler(async (req, res) => {
      const data = await selfServiceService.getMyAssignments(req.params.employeeId);
      res.status(200).json(data);
    }),
  );

  router.patch(
    "/:employeeId",
    asyncHandler(async (req, res) => {
      const employee = await service.updateEmployee(req.params.employeeId, req.body);
      const skills = await service.listEmployeeSkills(employee.employeeId);
      const [currentUtilizationPercent, assignments] = await Promise.all([
        assignmentService.getCurrentUtilization(employee.employeeId),
        assignmentService.listEmployeeAssignments(employee.employeeId),
      ]);
      res.status(200).json({ ...employee, currentUtilizationPercent, skills, assignments });
    }),
  );

  router.delete(
    "/:employeeId",
    asyncHandler(async (req, res) => {
      await service.deleteEmployee(req.params.employeeId);
      res.status(204).send();
    }),
  );

  return router;
}
