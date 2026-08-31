const prisma = require("../lib/prisma");

/**
 * Data-access layer for carts/cart items. No business logic here — that
 * lives in carts.service.js.
 *
 * @param {{ client?: import('@prisma/client').PrismaClient }} [deps]
 */
function createCartsRepository(deps = {}) {
  const client = deps.client || prisma;

  return {
    async createCart(tx = client) {
      return tx.cart.create({ data: { status: "OPEN" }, include: { items: true } });
    },

    async findCartById(id, tx = client) {
      return tx.cart.findUnique({
        where: { id },
        include: { items: { include: { product: true } } },
      });
    },

    async findProductById(id, tx = client) {
      return tx.product.findUnique({ where: { id } });
    },

    /** Insert a new item, or increase quantity if [cartId, productId] already exists (FR-002/FR-003). */
    async upsertItem(cartId, productId, quantity, unitPriceCents, tx = client) {
      const existing = await tx.cartItem.findUnique({
        where: { cartId_productId: { cartId, productId } },
      });
      if (existing) {
        await tx.cartItem.update({
          where: { id: existing.id },
          data: { quantity: existing.quantity + quantity },
        });
      } else {
        await tx.cartItem.create({
          data: { cartId, productId, quantity, unitPriceCents },
        });
      }
      return this.findCartById(cartId, tx);
    },

    async findItem(cartId, itemId, tx = client) {
      const item = await tx.cartItem.findUnique({ where: { id: itemId } });
      if (!item || item.cartId !== cartId) return null;
      return item;
    },

    async updateItemQuantity(cartId, itemId, quantity, tx = client) {
      await tx.cartItem.update({ where: { id: itemId }, data: { quantity } });
      return this.findCartById(cartId, tx);
    },

    async deleteItem(cartId, itemId, tx = client) {
      await tx.cartItem.delete({ where: { id: itemId } });
      return this.findCartById(cartId, tx);
    },

    async updateCartStatus(cartId, data, tx = client) {
      return tx.cart.update({ where: { id: cartId }, data });
    },

    async createTransaction(data, tx = client) {
      return tx.transaction.create({ data });
    },

    async runTransaction(fn) {
      return client.$transaction(fn);
    },
  };
}

module.exports = createCartsRepository;
