import express from "express";
import { createNotesRouter } from "./routers/notes.router.js";
import { NotesRepository } from "./repositories/notes.repository.js";
import { NotesService } from "./services/notes.service.js";

export function createApp() {
  const app = express();

  app.use(express.json());

  const notesService = new NotesService(new NotesRepository());
  app.use("/notes", createNotesRouter(notesService));

  return app;
}
