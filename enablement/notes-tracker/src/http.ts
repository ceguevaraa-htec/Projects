import type { Response } from "express";

/**
 * Sends a consistent `{ "error": "..." }` body for 4xx responses.
 * Shared by all routers so error shape stays uniform (contracts/notes-api.md).
 */
export function sendError(res: Response, status: number, message: string): void {
  res.status(status).json({ error: message });
}
