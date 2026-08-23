import { Router } from "express";
import { sendError } from "../http.js";
import type { NotesService } from "../services/notes.service.js";
import { NotFoundError, ValidationError } from "../services/notes.service.js";

/**
 * HTTP layer for /notes (constitution Principle I: router layer).
 *
 * Parses requests and maps service results/errors to status codes and
 * response shapes per contracts/notes-api.md. No validation or logging
 * logic lives here — that's the service layer's job.
 *
 * Takes the service as a parameter (rather than a module-level singleton) so
 * each `createApp()` call gets its own isolated in-memory store.
 */
export function createNotesRouter(service: NotesService): Router {
  const router = Router();

  router.post("/", (req, res) => {
    const { title, content } = req.body ?? {};
    try {
      const note = service.createNote(title, content);
      res.status(201).json(note);
    } catch (err) {
      if (err instanceof ValidationError) {
        sendError(res, 400, err.message);
        return;
      }
      throw err;
    }
  });

  router.get("/", (_req, res) => {
    res.status(200).json(service.listNotes());
  });

  router.get("/:id", (req, res) => {
    try {
      const note = service.getNoteById(req.params.id);
      res.status(200).json(note);
    } catch (err) {
      if (err instanceof NotFoundError) {
        sendError(res, 404, err.message);
        return;
      }
      throw err;
    }
  });

  router.patch("/:id", (req, res) => {
    const body = req.body ?? {};
    // Only include keys the client actually sent — an explicit `undefined`
    // would otherwise overwrite the note's existing value when merged.
    const changes: { title?: string; content?: string } = {};
    if (body.title !== undefined) changes.title = body.title;
    if (body.content !== undefined) changes.content = body.content;
    try {
      const note = service.updateNote(req.params.id, changes);
      res.status(200).json(note);
    } catch (err) {
      if (err instanceof ValidationError) {
        sendError(res, 400, err.message);
        return;
      }
      if (err instanceof NotFoundError) {
        sendError(res, 404, err.message);
        return;
      }
      throw err;
    }
  });

  router.delete("/:id", (req, res) => {
    try {
      service.deleteNote(req.params.id);
      res.status(204).send();
    } catch (err) {
      if (err instanceof NotFoundError) {
        sendError(res, 404, err.message);
        return;
      }
      throw err;
    }
  });

  return router;
}
