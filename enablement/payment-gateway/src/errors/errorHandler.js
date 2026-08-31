const AppError = require("./AppError");
const { logger } = require("../logging/logger");

/**
 * Centralized Express error-handling middleware (constitution Principle II).
 * MUST be mounted last. Translates any thrown/unhandled error (typed
 * AppError or not) into the single response shape:
 *   { statusCode, errorCode, message, requestId }
 *
 * No route/service code should build its own error JSON — everything flows
 * through here via `throw` or `next(err)`.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const requestId = (req && req.id) || res.getHeader("x-request-id") || null;

  const isAppError = err instanceof AppError;
  const statusCode = isAppError ? err.statusCode : 500;
  const errorCode = isAppError ? err.errorCode : "INTERNAL_ERROR";
  const message = isAppError ? err.message : "Internal server error";

  const log = (req && req.log) || logger;
  log.error(
    { err, statusCode, errorCode, requestId },
    "request failed with error"
  );

  res.status(statusCode).json({
    statusCode,
    errorCode,
    message,
    requestId,
  });
}

module.exports = errorHandler;
