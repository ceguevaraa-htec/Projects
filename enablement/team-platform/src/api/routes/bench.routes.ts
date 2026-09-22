import { Router } from "express";
import type { BenchService } from "../../domain/bench.service.js";
import { asyncHandler } from "../async-handler.js";

/** Routes matching specs/contracts/openapi-spec.yaml's /bench path exactly. */
export function createBenchRouter(service: BenchService): Router {
  const router = Router();

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const window = typeof req.query.window === "string" ? req.query.window : "";
      const entries = await service.getBenchView(window);
      res.status(200).json(entries);
    }),
  );

  return router;
}
