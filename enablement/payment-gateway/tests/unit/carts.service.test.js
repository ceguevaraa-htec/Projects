const { ValidationError, NotFoundError } = require("../../src/errors/errorCatalog");
const createCartsService = require("../../src/carts/carts.service");

/**
 * Unit tests for carts.service.js — cart creation, add-item quantity merge
 * (FR-002/FR-003), quantity update (FR-004), item removal (FR-005), and
 * quantity validation (FR-007).
 *
 * The repository is faked in-memory so these are true unit tests against
 * the service's business logic.
 */
function createFakeCartsRepository() {
  const carts = new Map();
  const products = new Map([
    ["prod-1", { id: "prod-1", name: "Widget", priceCents: 1000 }],
    ["prod-2", { id: "prod-2", name: "Gadget", priceCents: 2500 }],
  ]);
  let cartSeq = 0;
  let itemSeq = 0;

  return {
    _carts: carts,
    _products: products,
    async createCart() {
      const id = `cart-${++cartSeq}`;
      const cart = { id, status: "OPEN", items: [], createdAt: new Date() };
      carts.set(id, cart);
      return cart;
    },
    async findCartById(id) {
      return carts.get(id) || null;
    },
    async findProductById(id) {
      return products.get(id) || null;
    },
    async upsertItem(cartId, productId, quantity, unitPriceCents) {
      const cart = carts.get(cartId);
      const existing = cart.items.find((i) => i.productId === productId);
      if (existing) {
        existing.quantity += quantity;
      } else {
        cart.items.push({
          id: `item-${++itemSeq}`,
          cartId,
          productId,
          quantity,
          unitPriceCents,
        });
      }
      return cart;
    },
    async updateItemQuantity(cartId, itemId, quantity) {
      const cart = carts.get(cartId);
      const item = cart.items.find((i) => i.id === itemId);
      if (!item) return null;
      item.quantity = quantity;
      return cart;
    },
    async findItem(cartId, itemId) {
      const cart = carts.get(cartId);
      if (!cart) return null;
      return cart.items.find((i) => i.id === itemId) || null;
    },
    async deleteItem(cartId, itemId) {
      const cart = carts.get(cartId);
      cart.items = cart.items.filter((i) => i.id !== itemId);
      return cart;
    },
  };
}

describe("carts.service", () => {
  let repo;
  let cartsService;

  beforeEach(() => {
    repo = createFakeCartsRepository();
    cartsService = createCartsService({ repository: repo });
  });

  test("createCart creates a new empty OPEN cart", async () => {
    const cart = await cartsService.createCart();
    expect(cart.status).toBe("OPEN");
    expect(cart.items).toEqual([]);
  });

  test("addItem adds a new line item with snapshot unit price", async () => {
    const cart = await cartsService.createCart();
    const updated = await cartsService.addItem(cart.id, "prod-1", 2);
    expect(updated.items).toHaveLength(1);
    expect(updated.items[0]).toMatchObject({
      productId: "prod-1",
      quantity: 2,
      unitPriceCents: 1000,
    });
  });

  test("addItem merges quantity when product already in cart (FR-002/FR-003)", async () => {
    const cart = await cartsService.createCart();
    await cartsService.addItem(cart.id, "prod-1", 2);
    const updated = await cartsService.addItem(cart.id, "prod-1", 3);
    expect(updated.items).toHaveLength(1);
    expect(updated.items[0].quantity).toBe(5);
  });

  test("addItem rejects zero or negative quantity (FR-007)", async () => {
    const cart = await cartsService.createCart();
    await expect(cartsService.addItem(cart.id, "prod-1", 0)).rejects.toThrow(
      ValidationError
    );
    await expect(cartsService.addItem(cart.id, "prod-1", -1)).rejects.toThrow(
      ValidationError
    );
  });

  test("addItem rejects an unknown product id (FR-021)", async () => {
    const cart = await cartsService.createCart();
    await expect(
      cartsService.addItem(cart.id, "does-not-exist", 1)
    ).rejects.toThrow(NotFoundError);
  });

  test("addItem rejects an unknown cart id (FR-021)", async () => {
    await expect(
      cartsService.addItem("does-not-exist", "prod-1", 1)
    ).rejects.toThrow(NotFoundError);
  });

  test("updateItemQuantity updates an existing line item's quantity (FR-004)", async () => {
    const cart = await cartsService.createCart();
    const afterAdd = await cartsService.addItem(cart.id, "prod-1", 2);
    const itemId = afterAdd.items[0].id;
    const updated = await cartsService.updateItemQuantity(cart.id, itemId, 9);
    expect(updated.items[0].quantity).toBe(9);
  });

  test("updateItemQuantity rejects zero or negative quantity (FR-007)", async () => {
    const cart = await cartsService.createCart();
    const afterAdd = await cartsService.addItem(cart.id, "prod-1", 2);
    const itemId = afterAdd.items[0].id;
    await expect(
      cartsService.updateItemQuantity(cart.id, itemId, 0)
    ).rejects.toThrow(ValidationError);
  });

  test("updateItemQuantity rejects a missing line item (FR-021)", async () => {
    const cart = await cartsService.createCart();
    await expect(
      cartsService.updateItemQuantity(cart.id, "missing-item", 1)
    ).rejects.toThrow(NotFoundError);
  });

  test("removeItem removes a line item from the cart (FR-005)", async () => {
    const cart = await cartsService.createCart();
    const afterAdd = await cartsService.addItem(cart.id, "prod-1", 2);
    const itemId = afterAdd.items[0].id;
    const updated = await cartsService.removeItem(cart.id, itemId);
    expect(updated.items).toHaveLength(0);
  });

  test("removeItem rejects a missing line item (FR-021)", async () => {
    const cart = await cartsService.createCart();
    await expect(
      cartsService.removeItem(cart.id, "missing-item")
    ).rejects.toThrow(NotFoundError);
  });

  test("getCart computes subtotalCents from items", async () => {
    const cart = await cartsService.createCart();
    await cartsService.addItem(cart.id, "prod-1", 2); // 2000
    await cartsService.addItem(cart.id, "prod-2", 1); // 2500
    const result = await cartsService.getCart(cart.id);
    expect(result.subtotalCents).toBe(4500);
  });

  test("getCart rejects an unknown cart id (FR-021)", async () => {
    await expect(cartsService.getCart("does-not-exist")).rejects.toThrow(
      NotFoundError
    );
  });
});
