const pino = require("pino");
const pinoHttp = require("pino-http");
const { randomUUID } = require("crypto");

/**
 * Shared structured logger instance used across the app for domain events
 * (cart creation/changes, checkout attempts, payment submissions/results).
 */
const logger = pino({
  level: process.env.LOG_LEVEL || "info",
});

/**
 * Express middleware factory: attaches a per-request id (reused as the
 * error envelope's requestId) and logs request/response lines.
 */
function createHttpLogger() {
  return pinoHttp({
    logger,
    genReqId: (req, res) => {
      const existing = req.id || req.headers["x-request-id"];
      const id = existing || randomUUID();
      res.setHeader("x-request-id", id);
      return id;
    },
  });
}

module.exports = { logger, createHttpLogger };
