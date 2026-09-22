import { Router } from "express";
import type { EmployeeService } from "../../domain/employee.service.js";
import type { AssignmentService } from "../../domain/assignment.service.js";
import type { EmployeeListFilters, Proficiency, Seniority } from "../../domain/types.js";
import { asyncHandler } from "../async-handler.js";

/**
 * Routes matching specs/contracts/openapi-spec.yaml's /employees paths exactly.
 *
 * As of EPIC-0003, `currentUtilizationPercent` and embedded `assignments` are computed via the
 * shared `AssignmentService.getCurrentUtilization`/`listEmployeeAssignments` — no longer
 * hardcoded to 0/[] as they were in EPIC-0001 (see that epic's data-model.md, now resolved).
 * `currentProjectNames` remains [] — it was never flagged as a tracked forward-reference and is
 * out of this epic's scope.
 */
export function createEmployeesRouter(
  service: EmployeeService,
  assignmentService: AssignmentService,
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
        sort: req.query.sort as EmployeeListFilters["sort"],
        order: req.query.order as EmployeeListFilters["order"],
      };
      const employees = await service.listEmployees(filters);

      const summaries = await Promise.all(
        employees.map(async (employee) => ({
          employeeId: employee.employeeId,
          name: employee.name,
          seniority: employee.seniority,
          currentUtilizationPercent: await assignmentService.getCurrentUtilization(
            employee.employeeId,
          ),
          currentProjectNames: [] as string[],
        })),
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
