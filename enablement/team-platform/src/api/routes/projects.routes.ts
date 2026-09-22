import { Router } from "express";
import type { ProjectService } from "../../domain/project.service.js";
import type { AssignmentService } from "../../domain/assignment.service.js";
import type { ProjectListFilters, ProjectRoleRecord, ProjectStatus } from "../../domain/types.js";
import { asyncHandler } from "../async-handler.js";

/**
 * The OpenAPI `ProjectRole` schema has no `projectId` field (a role is always accessed via its
 * parent project's path, so the field would be redundant) — strip it from the domain record
 * before serializing, here rather than relying on callers to remember.
 */
function toApiRole(role: ProjectRoleRecord) {
  const { projectId: _projectId, ...apiRole } = role;
  return apiRole;
}

/** Routes matching specs/contracts/openapi-spec.yaml's /projects paths exactly. */
export function createProjectsRouter(service: ProjectService): Router {
  const router = Router();

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      const project = await service.createProject(req.body);
      res.status(201).json(project);
    }),
  );

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const filters: ProjectListFilters = {
        status: req.query.status as ProjectStatus | undefined,
        requiredRole:
          typeof req.query.requiredRole === "string" ? req.query.requiredRole : undefined,
        startDateFrom:
          typeof req.query.startDateFrom === "string" ? req.query.startDateFrom : undefined,
        startDateTo: typeof req.query.startDateTo === "string" ? req.query.startDateTo : undefined,
        sort: req.query.sort as ProjectListFilters["sort"],
        order: req.query.order as ProjectListFilters["order"],
      };
      const projects = await service.listProjects(filters);

      const summaries = await Promise.all(
        projects.map(async (project) => {
          const roles = await service.listProjectRoles(project.projectId);
          return {
            projectId: project.projectId,
            name: project.name,
            status: project.status,
            startDate: project.startDate,
            endDate: project.endDate,
            requiredRoleCount: roles.length,
          };
        }),
      );
      res.status(200).json(summaries);
    }),
  );

  router.get(
    "/:projectId",
    asyncHandler(async (req, res) => {
      const project = await service.getProject(req.params.projectId);
      const requiredRoles = (await service.listProjectRoles(project.projectId)).map(toApiRole);
      res.status(200).json({ ...project, requiredRoles });
    }),
  );

  router.patch(
    "/:projectId",
    asyncHandler(async (req, res) => {
      const project = await service.updateProject(req.params.projectId, req.body);
      res.status(200).json(project);
    }),
  );

  router.delete(
    "/:projectId",
    asyncHandler(async (req, res) => {
      await service.deleteProject(req.params.projectId);
      res.status(204).send();
    }),
  );

  router.post(
    "/:projectId/roles",
    asyncHandler(async (req, res) => {
      const role = await service.addProjectRole(req.params.projectId, req.body);
      res.status(201).json(toApiRole(role));
    }),
  );

  router.patch(
    "/:projectId/roles/:roleId",
    asyncHandler(async (req, res) => {
      const role = await service.updateProjectRole(
        req.params.projectId,
        req.params.roleId,
        req.body,
      );
      res.status(200).json(toApiRole(role));
    }),
  );

  router.delete(
    "/:projectId/roles/:roleId",
    asyncHandler(async (req, res) => {
      await service.removeProjectRole(req.params.projectId, req.params.roleId);
      res.status(204).send();
    }),
  );

  return router;
}

/**
 * Separate router for the candidates endpoint (EPIC-0003), mounted alongside
 * createProjectsRouter's output in app.ts. Kept as its own factory (rather than adding an
 * AssignmentService parameter to createProjectsRouter) since it depends on a different service.
 */
export function createProjectRoleCandidatesRouter(service: AssignmentService): Router {
  const router = Router();

  router.get(
    "/:projectId/roles/:roleId/candidates",
    asyncHandler(async (req, res) => {
      const candidates = await service.listCandidates(req.params.projectId, req.params.roleId);
      res.status(200).json(candidates);
    }),
  );

  return router;
}
