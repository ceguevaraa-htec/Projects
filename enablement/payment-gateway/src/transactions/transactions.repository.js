const prisma = require("../lib/prisma");

/**
 * Data-access layer for transactions: find by id, paged findMany with
 * status/cartId filters (FR-019, FR-020).
 *
 * @param {{ client?: import('@prisma/client').PrismaClient }} [deps]
 */
function createTransactionsRepository(deps = {}) {
  const client = deps.client || prisma;

  return {
    async findById(id) {
      return client.transaction.findUnique({ where: { id } });
    },

    async findMany({ page, pageSize, status, cartId }) {
      const where = {};
      if (status) where.status = status;
      if (cartId) where.cartId = cartId;

      const [items, total] = await Promise.all([
        client.transaction.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { createdAt: "desc" },
        }),
        client.transaction.count({ where }),
      ]);

      return { items, total };
    },
  };
}

module.exports = createTransactionsRepository;
