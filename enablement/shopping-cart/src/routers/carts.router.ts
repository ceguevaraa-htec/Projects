import { Router } from "express";
import type { CartsService } from "../services/carts.service.js";

/**
 * HTTP layer for /carts (constitution Principle I: router layer).
 *
 * Parses requests, calls the service, and maps its result to a response per
 * contracts/cart-api.md. No validation or logging logic lives here — thrown service errors
 * are forwarded to the app's central error-handling middleware (src/app.ts) via `next(err)`.
 *
 * Takes the service as a parameter (rather than a module-level singleton) so each
 * `createApp()` call gets its own isolated in-memory store.
 */
export function createCartsRouter(service: CartsService): Router {
  const router = Router();

  router.post("/", (_req, res) => {
    res.status(201).json(service.createCart());
  });

  router.get("/:cartId", (req, res, next) => {
    try {
      res.status(200).json(service.getCart(req.params.cartId));
    } catch (err) {
      next(err);
    }
  });

  router.post("/:cartId/items", (req, res, next) => {
    const { productId, quantity, price } = req.body ?? {};
    try {
      res.status(200).json(service.addItem(req.params.cartId, productId, quantity, price));
    } catch (err) {
      next(err);
    }
  });

  router.patch("/:cartId/items/:productId", (req, res, next) => {
    const { quantity } = req.body ?? {};
    try {
      res
        .status(200)
        .json(service.updateItemQuantity(req.params.cartId, req.params.productId, quantity));
    } catch (err) {
      next(err);
    }
  });

  router.delete("/:cartId/items/:productId", (req, res, next) => {
    try {
      res.status(200).json(service.removeItem(req.params.cartId, req.params.productId));
    } catch (err) {
      next(err);
    }
  });

  router.post("/:cartId/checkout", (req, res, next) => {
    try {
      res.status(200).json(service.checkout(req.params.cartId));
    } catch (err) {
      next(err);
    }
  });

  router.post("/:cartId/clear", (req, res, next) => {
    try {
      res.status(200).json(service.clearCart(req.params.cartId));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
