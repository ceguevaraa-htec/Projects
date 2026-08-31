const prisma = require("../lib/prisma");

/**
 * Data-access layer for products: paged Prisma findMany with category,
 * priceCents range, and name contains-search filters (FR-008–FR-011).
 *
 * @param {{ client?: import('@prisma/client').PrismaClient }} [deps]
 */
function createProductsRepository(deps = {}) {
  const client = deps.client || prisma;

  return {
    async findMany({ page, pageSize, q, category, minPrice, maxPrice }) {
      const where = {};
      if (q) {
        where.name = { contains: q };
      }
      if (category) {
        where.category = category;
      }
      if (minPrice != null || maxPrice != null) {
        where.priceCents = {};
        if (minPrice != null) where.priceCents.gte = minPrice;
        if (maxPrice != null) where.priceCents.lte = maxPrice;
      }

      const [items, total] = await Promise.all([
        client.product.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { createdAt: "asc" },
        }),
        client.product.count({ where }),
      ]);

      return { items, total };
    },

    async findById(id) {
      return client.product.findUnique({ where: { id } });
    },
  };
}

module.exports = createProductsRepository;
