import path from "node:path";
import express from "express";
import { createNotesRouter } from "./routers/notes.router.js";
import { NotesRepository } from "./repositories/notes.repository.js";
import { NotesService } from "./services/notes.service.js";

// Resolved relative to the process working directory (the repo root, per
// how `npm run dev`/`npm start` are invoked) rather than this file's own
// location, so it resolves the same whether running from source or from a
// compiled `dist/` build.
const PUBLIC_DIR = path.resolve(process.cwd(), "public");

export function createApp() {
  const app = express();

  app.use(express.json());

  // Serves the notes web UI (index.html, create.html, edit.html, etc.) as
  // static files — see specs/002-notes-web-ui/plan.md. Mounted before the
  // API routes; express.static only handles GET/HEAD requests for files
  // that actually exist, so it does not intercept /notes API requests.
  app.use(express.static(PUBLIC_DIR));

  const notesService = new NotesService(new NotesRepository());
  app.use("/notes", createNotesRouter(notesService));

  return app;
}
