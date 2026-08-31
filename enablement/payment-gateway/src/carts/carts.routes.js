const express = require("express");
const createCartsService = require("./carts.service");

/**
 * Carts router. A PaymentGateway implementation is injected via `deps`
 * (constitution Principle V) — never imported by name here.
 *
 * @param {{ paymentGateway?: import('../payment/PaymentGateway'), cartsService?: ReturnType<typeof createCartsService> }} [deps]
 */
function createCartsRouter(deps = {}) {
  const router = express.Router();
  const cartsService =
    deps.cartsService ||
    createCartsService({ paymentGateway: deps.paymentGateway });

  router.post("/", async (req, res, next) => {
    try {
      const cart = await cartsService.createCart();
      res.status(201).json(cart);
    } catch (err) {
      next(err);
    }
  });

  router.get("/:cartId", async (req, res, next) => {
    try {
      const cart = await cartsService.getCart(req.params.cartId);
      res.status(200).json(cart);
    } catch (err) {
      next(err);
    }
  });

  router.post("/:cartId/items", async (req, res, next) => {
    try {
      const { productId, quantity } = req.body || {};
      const cart = await cartsService.addItem(
        req.params.cartId,
        productId,
        quantity
      );
      res.status(200).json(cart);
    } catch (err) {
      next(err);
    }
  });

  router.patch("/:cartId/items/:itemId", async (req, res, next) => {
    try {
      const { quantity } = req.body || {};
      const cart = await cartsService.updateItemQuantity(
        req.params.cartId,
        req.params.itemId,
        quantity
      );
      res.status(200).json(cart);
    } catch (err) {
      next(err);
    }
  });

  router.delete("/:cartId/items/:itemId", async (req, res, next) => {
    try {
      const cart = await cartsService.removeItem(
        req.params.cartId,
        req.params.itemId
      );
      res.status(200).json(cart);
    } catch (err) {
      next(err);
    }
  });

  router.post("/:cartId/checkout", async (req, res, next) => {
    try {
      const { promoCode } = req.body || {};
      const transaction = await cartsService.checkout(req.params.cartId, {
        promoCode,
      });
      res.status(200).json(transaction);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = createCartsRouter;
