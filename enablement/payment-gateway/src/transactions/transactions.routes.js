const express = require("express");
const createTransactionsService = require("./transactions.service");

/** @param {{ transactionsService?: ReturnType<typeof createTransactionsService> }} [deps] */
function createTransactionsRouter(deps = {}) {
  const router = express.Router();
  const transactionsService =
    deps.transactionsService || createTransactionsService();

  router.get("/:transactionId", async (req, res, next) => {
    try {
      const transaction = await transactionsService.getTransaction(
        req.params.transactionId
      );
      res.status(200).json(transaction);
    } catch (err) {
      next(err);
    }
  });

  router.get("/", async (req, res, next) => {
    try {
      const result = await transactionsService.listTransactions(req.query);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = createTransactionsRouter;
