const express = require("express");
const createProductsService = require("./products.service");

/** @param {{ productsService?: ReturnType<typeof createProductsService> }} [deps] */
function createProductsRouter(deps = {}) {
  const router = express.Router();
  const productsService = deps.productsService || createProductsService();

  router.get("/", async (req, res, next) => {
    try {
      const result = await productsService.listProducts(req.query);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  router.get("/:productId", async (req, res, next) => {
    try {
      const product = await productsService.getProduct(req.params.productId);
      res.status(200).json(product);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = createProductsRouter;
