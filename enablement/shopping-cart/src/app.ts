import express, { type ErrorRequestHandler } from "express";
import { mapErrorToResponse } from "./http.js";
import { CartsRepository } from "./repositories/carts.repository.js";
import { CartsService } from "./services/carts.service.js";
import { createCartsRouter } from "./routers/carts.router.js";

export function createApp() {
  const app = express();
  app.use(express.json());

  const cartsService = new CartsService(new CartsRepository());
  app.use("/carts", createCartsRouter(cartsService));

  const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
    if (res.headersSent) {
      next(err);
      return;
    }
    const mapped = mapErrorToResponse(err);
    if (mapped) {
      res.status(mapped.status).json(mapped.body);
      return;
    }
    // Unrecognized error: don't leak internals, but don't swallow it either.
    console.error(err);
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Unexpected server error." });
  };
  app.use(errorHandler);

  return app;
}
