/**
 * Base class for all typed application errors. Carries an HTTP statusCode
 * and a machine-readable errorCode so the centralized error handler can
 * translate any thrown AppError into a consistent response shape.
 */
class AppError extends Error {
  /**
   * @param {string} message - human-readable message
   * @param {number} statusCode - HTTP status code to respond with
   * @param {string} errorCode - machine-readable error code
   */
  constructor(message, statusCode = 500, errorCode = "INTERNAL_ERROR") {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
