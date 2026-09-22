import type { NextFunction, Request, Response } from "express";

/**
 * Logs one structured JSON line per request (timestamp, method, route, duration, status),
 * per SDP NFR-0003. Scoped to the HTTP request/response boundary only.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const entry = {
      timestamp: new Date().toISOString(),
      method: req.method,
      route: req.originalUrl,
      durationMs: Math.round(durationMs * 100) / 100,
      statusCode: res.statusCode,
    };
    console.log(JSON.stringify(entry));
  });

  next();
}
