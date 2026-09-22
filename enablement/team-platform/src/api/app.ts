import express, { type Express } from "express";
import type { Kysely } from "kysely";
import type { Database } from "../db/schema.js";
import { KyselyEmployeeRepository } from "../repositories/employee.repository.js";
import { KyselySkillRepository } from "../repositories/skill.repository.js";
import { KyselyProjectRepository } from "../repositories/project.repository.js";
import { EmployeeService } from "../domain/employee.service.js";
import { SkillService } from "../domain/skill.service.js";
import { ProjectService } from "../domain/project.service.js";
import { requestLogger } from "./middleware/request-logger.js";
import { errorHandler } from "./middleware/error-handler.js";
import { createEmployeesRouter } from "./routes/employees.routes.js";
import { createEmployeeSkillsRouter } from "./routes/employee-skills.routes.js";
import { createSkillsRouter } from "./routes/skills.routes.js";
import { createProjectsRouter } from "./routes/projects.routes.js";

/** Assembles the Express app: middleware + routes. No server listen() here. */
export function createApp(db: Kysely<Database>): Express {
  const employeeRepository = new KyselyEmployeeRepository(db);
  const skillRepository = new KyselySkillRepository(db);
  const projectRepository = new KyselyProjectRepository(db);
  const employeeService = new EmployeeService(employeeRepository, skillRepository);
  const skillService = new SkillService(skillRepository);
  const projectService = new ProjectService(projectRepository, skillRepository);

  const app = express();

  app.use(express.json());
  app.use(requestLogger);

  app.use("/employees", createEmployeesRouter(employeeService));
  app.use("/employees", createEmployeeSkillsRouter(employeeService));
  app.use("/skills", createSkillsRouter(skillService));
  app.use("/projects", createProjectsRouter(projectService));

  app.use(errorHandler);

  return app;
}
