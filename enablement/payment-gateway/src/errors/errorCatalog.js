const AppError = require("./AppError");

/** 404 — a cart, product, or transaction identifier does not resolve (FR-021) */
class NotFoundError extends AppError {
  constructor(message = "Resource not found", errorCode = "NOT_FOUND") {
    super(message, 404, errorCode);
  }
}

/** 400 — invalid input (e.g. quantity <= 0, invalid paging/filter params, invalid promo code) */
class ValidationError extends AppError {
  constructor(message = "Validation failed", errorCode = "VALIDATION_ERROR") {
    super(message, 400, errorCode);
  }
}

/** 409 — a state transition is not allowed (e.g. checkout on a non-OPEN cart) */
class ConflictError extends AppError {
  constructor(message = "Conflicting state", errorCode = "CONFLICT") {
    super(message, 409, errorCode);
  }
}

module.exports = { NotFoundError, ValidationError, ConflictError };
