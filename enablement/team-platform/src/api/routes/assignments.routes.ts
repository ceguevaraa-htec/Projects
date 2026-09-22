import { Router } from "express";
import type { AssignmentService } from "../../domain/assignment.service.js";
import { asyncHandler } from "../async-handler.js";

/** Routes matching specs/contracts/openapi-spec.yaml's /assignments paths exactly. */
export function createAssignmentsRouter(service: AssignmentService): Router {
  const router = Router();

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      const assignment = await service.createAssignment(req.body);
      res.status(201).json(assignment);
    }),
  );

  router.get(
    "/:assignmentId",
    asyncHandler(async (req, res) => {
      const assignment = await service.getAssignment(req.params.assignmentId);
      res.status(200).json(assignment);
    }),
  );

  router.patch(
    "/:assignmentId",
    asyncHandler(async (req, res) => {
      const assignment = await service.updateAssignment(req.params.assignmentId, req.body);
      res.status(200).json(assignment);
    }),
  );

  router.delete(
    "/:assignmentId",
    asyncHandler(async (req, res) => {
      await service.cancelAssignment(req.params.assignmentId);
      res.status(204).send();
    }),
  );

  return router;
}
