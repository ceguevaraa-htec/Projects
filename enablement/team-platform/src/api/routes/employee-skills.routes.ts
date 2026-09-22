import { Router } from "express";
import type { EmployeeService } from "../../domain/employee.service.js";
import { asyncHandler } from "../async-handler.js";

/** Routes matching specs/contracts/openapi-spec.yaml's /employees/{employeeId}/skills paths. */
export function createEmployeeSkillsRouter(service: EmployeeService): Router {
  const router = Router();

  router.post(
    "/:employeeId/skills",
    asyncHandler(async (req, res) => {
      const association = await service.addEmployeeSkill(
        req.params.employeeId,
        req.body.skillId,
        req.body.proficiency,
      );
      res.status(201).json(association);
    }),
  );

  router.patch(
    "/:employeeId/skills/:skillId",
    asyncHandler(async (req, res) => {
      const association = await service.updateEmployeeSkill(
        req.params.employeeId,
        req.params.skillId,
        req.body.proficiency,
      );
      res.status(200).json(association);
    }),
  );

  router.delete(
    "/:employeeId/skills/:skillId",
    asyncHandler(async (req, res) => {
      await service.removeEmployeeSkill(req.params.employeeId, req.params.skillId);
      res.status(204).send();
    }),
  );

  return router;
}
