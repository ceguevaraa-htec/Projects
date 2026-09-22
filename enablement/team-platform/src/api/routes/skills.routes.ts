import { Router } from "express";
import type { SkillService } from "../../domain/skill.service.js";
import { asyncHandler } from "../async-handler.js";

/** Routes matching specs/contracts/openapi-spec.yaml's /skills paths exactly. */
export function createSkillsRouter(service: SkillService): Router {
  const router = Router();

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      const skill = await service.createSkill(req.body.name);
      res.status(201).json(skill);
    }),
  );

  router.get(
    "/",
    asyncHandler(async (_req, res) => {
      const skills = await service.listSkills();
      res.status(200).json(skills);
    }),
  );

  router.patch(
    "/:skillId",
    asyncHandler(async (req, res) => {
      const skill = await service.renameSkill(req.params.skillId, req.body.name);
      res.status(200).json(skill);
    }),
  );

  router.get(
    "/:skillId/deletion-impact",
    asyncHandler(async (req, res) => {
      const impact = await service.getDeletionImpact(req.params.skillId);
      res.status(200).json(impact);
    }),
  );

  router.delete(
    "/:skillId",
    asyncHandler(async (req, res) => {
      await service.deleteSkill(req.params.skillId);
      res.status(204).send();
    }),
  );

  return router;
}
