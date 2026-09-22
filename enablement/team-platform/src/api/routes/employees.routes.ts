import { Router } from "express";
import type { EmployeeService } from "../../domain/employee.service.js";
import type { EmployeeListFilters, Proficiency, Seniority } from "../../domain/types.js";
import { asyncHandler } from "../async-handler.js";

/** Routes matching specs/contracts/openapi-spec.yaml's /employees paths exactly. */
export function createEmployeesRouter(service: EmployeeService): Router {
  const router = Router();

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      const employee = await service.createEmployee(req.body);
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
          currentUtilizationPercent: 0,
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
      res.status(200).json({
        ...employee,
        currentUtilizationPercent: 0,
        skills,
        assignments: [],
      });
    }),
  );

  router.patch(
    "/:employeeId",
    asyncHandler(async (req, res) => {
      const employee = await service.updateEmployee(req.params.employeeId, req.body);
      const skills = await service.listEmployeeSkills(employee.employeeId);
      res.status(200).json({ ...employee, currentUtilizationPercent: 0, skills, assignments: [] });
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
