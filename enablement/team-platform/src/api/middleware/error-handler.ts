import type { NextFunction, Request, Response } from "express";
import { DomainError } from "../../domain/errors/domain-errors.js";

interface ErrorResponseBody {
  error_code: string;
  message: string;
}

/**
 * Maps every thrown error to the { error_code, message } envelope (NFR-0005/ADR-0009).
 * DomainError subclasses map to their own declared code/status; anything else (a bug,
 * an unexpected exception) still produces a valid envelope rather than a raw stack trace.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof DomainError) {
    const body: ErrorResponseBody = { error_code: err.errorCode, message: err.message };
    res.status(err.httpStatus).json(body);
    return;
  }

  const body: ErrorResponseBody = {
    error_code: "INTERNAL_ERROR",
    message: "An unexpected error occurred.",
  };
  res.status(500).json(body);
}
