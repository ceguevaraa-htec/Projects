const express = require("express");
const { createHttpLogger } = require("./logging/logger");
const errorHandler = require("./errors/errorHandler");
const MockPaymentGateway = require("./payment/MockPaymentGateway");

const createProductsRouter = require("./products/products.routes");
const createCartsRouter = require("./carts/carts.routes");
const createTransactionsRouter = require("./transactions/transactions.routes");

/**
 * Build the Express app. A PaymentGateway implementation is
 * constructor-injected here (constitution Principle V) — carts.service.js
 * never requires MockPaymentGateway directly.
 *
 * @param {{ paymentGateway?: import('./payment/PaymentGateway') }} [deps]
 */
function createApp(deps = {}) {
  const paymentGateway = deps.paymentGateway || new MockPaymentGateway();

  const app = express();

  app.use(createHttpLogger());
  app.use(express.json());

  app.use("/api/v1/products", createProductsRouter());
  app.use("/api/v1/carts", createCartsRouter({ paymentGateway }));
  app.use("/api/v1/transactions", createTransactionsRouter());

  // Centralized error-handling middleware — MUST be mounted last.
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
