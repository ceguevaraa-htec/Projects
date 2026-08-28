/**
 * Typed service-layer errors and the HTTP mapping for them (constitution Principle IV).
 * The service layer throws these; the router's error-handling middleware translates them
 * into a structured `{ error, message }` response with the appropriate status code, instead
 * of letting an unhandled exception reach the client.
 */

export class CartNotFoundError extends Error {
  constructor(cartId: string) {
    super(`Cart ${cartId} does not exist.`);
    this.name = "CartNotFoundError";
  }
}

export class ItemNotFoundError extends Error {
  constructor(cartId: string, productId: string) {
    super(`Product ${productId} is not in cart ${cartId}.`);
    this.name = "ItemNotFoundError";
  }
}

export class CartFinalizedError extends Error {
  constructor(cartId: string) {
    super(`Cart ${cartId} has already been checked out.`);
    this.name = "CartFinalizedError";
  }
}

export class EmptyCartCheckoutError extends Error {
  constructor(cartId: string) {
    super(`Cannot check out cart ${cartId}: it has no items.`);
    this.name = "EmptyCartCheckoutError";
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

interface ErrorResponse {
  status: number;
  body: { error: string; message: string };
}

/**
 * Maps a typed service error to its HTTP status and structured body. Returns undefined for
 * an error it doesn't recognize, so the caller can fall back to a generic 500.
 */
export function mapErrorToResponse(err: unknown): ErrorResponse | undefined {
  if (err instanceof CartNotFoundError) {
    return { status: 404, body: { error: "CART_NOT_FOUND", message: err.message } };
  }
  if (err instanceof ItemNotFoundError) {
    return { status: 404, body: { error: "ITEM_NOT_FOUND", message: err.message } };
  }
  if (err instanceof CartFinalizedError) {
    return { status: 409, body: { error: "CART_FINALIZED", message: err.message } };
  }
  if (err instanceof EmptyCartCheckoutError) {
    return { status: 409, body: { error: "EMPTY_CART_CHECKOUT", message: err.message } };
  }
  if (err instanceof ValidationError) {
    return { status: 400, body: { error: "VALIDATION_ERROR", message: err.message } };
  }
  return undefined;
}
