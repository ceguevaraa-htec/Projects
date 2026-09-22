import { Router } from "express";
import type { ReportsService } from "../../domain/reports.service.js";
import {
  renderEmployeeReport,
  renderOrgReport,
  renderProjectReport,
} from "../../reports/pdf-renderer.js";
import { asyncHandler } from "../async-handler.js";

/** Routes matching specs/contracts/openapi-spec.yaml's /reports paths exactly. */
export function createReportsRouter(service: ReportsService): Router {
  const router = Router();

  router.get(
    "/org",
    asyncHandler(async (_req, res) => {
      const data = await service.assembleOrgReport();
      const pdf = await renderOrgReport(data);
      res.status(200).contentType("application/pdf").send(pdf);
    }),
  );

  router.get(
    "/employees/:employeeId",
    asyncHandler(async (req, res) => {
      const data = await service.assembleEmployeeReport(req.params.employeeId);
      const pdf = await renderEmployeeReport(data);
      res.status(200).contentType("application/pdf").send(pdf);
    }),
  );

  router.get(
    "/projects/:projectId",
    asyncHandler(async (req, res) => {
      const data = await service.assembleProjectReport(req.params.projectId);
      const pdf = await renderProjectReport(data);
      res.status(200).contentType("application/pdf").send(pdf);
    }),
  );

  return router;
}
