const { ValidationError, ConflictError, NotFoundError } = require("../../src/errors/errorCatalog");
const createCartsService = require("../../src/carts/carts.service");

/**
 * Unit tests for checkout total/discount calculation, promo-code
 * validation (valid, invalid, expired code per FR-025), empty-cart
 * rejection (FR-016), and already-Paid rejection (FR-017).
 *
 * Uses an in-memory fake repository + fake PaymentGateway + fake
 * promoCode lookup so the checkout orchestration logic in
 * carts.service.js is exercised without touching Prisma.
 */
function createFakeRepository({ initialCarts = {}, products = {} } = {}) {
  const carts = new Map(Object.entries(initialCarts));
  let txCounter = 0;

  function cloneCart(cart) {
    return JSON.parse(JSON.stringify(cart));
  }

  const api = {
    async createCart() {
      throw new Error("not needed for checkout tests");
    },
    async findCartById(id) {
      const cart = carts.get(id);
      return cart ? cloneCart(cart) : null;
    },
    async findProductById(id) {
      return products[id] || null;
    },
    async upsertItem() {
      throw new Error("not needed for checkout tests");
    },
    async findItem() {
      throw new Error("not needed for checkout tests");
    },
    async updateItemQuantity() {
      throw new Error("not needed for checkout tests");
    },
    async deleteItem() {
      throw new Error("not needed for checkout tests");
    },
    async updateCartStatus(cartId, data) {
      const cart = carts.get(cartId);
      Object.assign(cart, data);
      return cloneCart(cart);
    },
    async createTransaction(data) {
      const id = `txn-${++txCounter}`;
      const txn = { id, createdAt: new Date(), ...data };
      return txn;
    },
    // Runs fn against this same repository — no real DB transaction needed
    // for unit-level checkout logic tests.
    async runTransaction(fn) {
      return fn(api);
    },
  };
  return api;
}

function createFakePromoCodeService(codes = {}) {
  return {
    async validate(code) {
      if (!code) return null;
      const found = codes[code];
      if (!found) {
        throw new ValidationError(`Invalid promo code: ${code}`, "INVALID_PROMO_CODE");
      }
      if (!found.active) {
        throw new ValidationError(`Promo code is not active: ${code}`, "INVALID_PROMO_CODE");
      }
      if (found.expiresAt && found.expiresAt.getTime() < Date.now()) {
        throw new ValidationError(`Promo code has expired: ${code}`, "INVALID_PROMO_CODE");
      }
      return found;
    },
    computeDiscountCents(subtotalCents, promoCode) {
      if (!promoCode) return 0;
      if (promoCode.discountType === "PERCENT") {
        return Math.round((subtotalCents * promoCode.discountValue) / 100);
      }
      if (promoCode.discountType === "FIXED") {
        return Math.min(promoCode.discountValue, subtotalCents);
      }
      return 0;
    },
  };
}

function createFakeGateway(status) {
  return {
    async submitPayment() {
      return { status, gatewayReference: `ref-${status}` };
    },
    async getPaymentStatus() {
      return null;
    },
  };
}

describe("carts.service checkout", () => {
  test("computes total from item prices and quantities with no discount", async () => {
    const repository = createFakeRepository({
      initialCarts: {
        "cart-1": {
          id: "cart-1",
          status: "OPEN",
          items: [
            { id: "i1", cartId: "cart-1", productId: "p1", quantity: 2, unitPriceCents: 1000 },
            { id: "i2", cartId: "cart-1", productId: "p2", quantity: 1, unitPriceCents: 500 },
          ],
        },
      },
    });
    const cartsService = createCartsService({
      repository,
      paymentGateway: createFakeGateway("approved"),
      promoCodeService: createFakePromoCodeService(),
    });

    const txn = await cartsService.checkout("cart-1", {});
    expect(txn.totalCents).toBe(2500);
    expect(txn.discountCents).toBe(0);
    expect(txn.status).toBe("APPROVED");
  });

  test("applies a valid promo code discount", async () => {
    const repository = createFakeRepository({
      initialCarts: {
        "cart-1": {
          id: "cart-1",
          status: "OPEN",
          items: [
            { id: "i1", cartId: "cart-1", productId: "p1", quantity: 1, unitPriceCents: 1000 },
          ],
        },
      },
    });
    const cartsService = createCartsService({
      repository,
      paymentGateway: createFakeGateway("approved"),
      promoCodeService: createFakePromoCodeService({
        WELCOME10: { id: "promo-1", discountType: "PERCENT", discountValue: 10, active: true, expiresAt: null },
      }),
    });

    const txn = await cartsService.checkout("cart-1", { promoCode: "WELCOME10" });
    expect(txn.discountCents).toBe(100);
    expect(txn.totalCents).toBe(900);
  });

  test("rejects an invalid promo code (FR-025)", async () => {
    const repository = createFakeRepository({
      initialCarts: {
        "cart-1": {
          id: "cart-1",
          status: "OPEN",
          items: [{ id: "i1", cartId: "cart-1", productId: "p1", quantity: 1, unitPriceCents: 1000 }],
        },
      },
    });
    const cartsService = createCartsService({
      repository,
      paymentGateway: createFakeGateway("approved"),
      promoCodeService: createFakePromoCodeService({}),
    });

    await expect(
      cartsService.checkout("cart-1", { promoCode: "BOGUS" })
    ).rejects.toThrow(ValidationError);
  });

  test("rejects an expired promo code (FR-025)", async () => {
    const repository = createFakeRepository({
      initialCarts: {
        "cart-1": {
          id: "cart-1",
          status: "OPEN",
          items: [{ id: "i1", cartId: "cart-1", productId: "p1", quantity: 1, unitPriceCents: 1000 }],
        },
      },
    });
    const cartsService = createCartsService({
      repository,
      paymentGateway: createFakeGateway("approved"),
      promoCodeService: createFakePromoCodeService({
        EXPIRED: { id: "promo-2", discountType: "PERCENT", discountValue: 10, active: true, expiresAt: new Date("2000-01-01") },
      }),
    });

    await expect(
      cartsService.checkout("cart-1", { promoCode: "EXPIRED" })
    ).rejects.toThrow(ValidationError);
  });

  test("rejects checkout of an empty cart (FR-016)", async () => {
    const repository = createFakeRepository({
      initialCarts: { "cart-1": { id: "cart-1", status: "OPEN", items: [] } },
    });
    const cartsService = createCartsService({
      repository,
      paymentGateway: createFakeGateway("approved"),
      promoCodeService: createFakePromoCodeService(),
    });

    await expect(cartsService.checkout("cart-1", {})).rejects.toThrow(
      ValidationError
    );
  });

  test("rejects checkout of an already-Paid cart (FR-017)", async () => {
    const repository = createFakeRepository({
      initialCarts: {
        "cart-1": {
          id: "cart-1",
          status: "PAID",
          items: [{ id: "i1", cartId: "cart-1", productId: "p1", quantity: 1, unitPriceCents: 1000 }],
        },
      },
    });
    const cartsService = createCartsService({
      repository,
      paymentGateway: createFakeGateway("approved"),
      promoCodeService: createFakePromoCodeService(),
    });

    // Per contracts/openapi.yaml, the already-final-status case is a 400
    // (ValidationError); ConflictError (409) is reserved for T035a's
    // concurrent-checkout race re-check inside the transaction.
    await expect(cartsService.checkout("cart-1", {})).rejects.toThrow(
      ValidationError
    );
  });

  test("T035a: aborts with ConflictError when the cart is no longer OPEN by the time the transaction runs", async () => {
    const repository = createFakeRepository({
      initialCarts: {
        "cart-1": {
          id: "cart-1",
          status: "OPEN",
          items: [{ id: "i1", cartId: "cart-1", productId: "p1", quantity: 1, unitPriceCents: 1000 }],
        },
      },
    });
    // Simulate a concurrent checkout that flips the cart to PAID
    // in between the initial read and the transaction's internal re-read.
    const originalRunTransaction = repository.runTransaction.bind(repository);
    repository.runTransaction = async (fn) => {
      await repository.updateCartStatus("cart-1", { status: "PAID" });
      return originalRunTransaction(fn);
    };
    const cartsService = createCartsService({
      repository,
      paymentGateway: createFakeGateway("approved"),
      promoCodeService: createFakePromoCodeService(),
    });

    await expect(cartsService.checkout("cart-1", {})).rejects.toThrow(
      ConflictError
    );
  });

  test("sets cart status to FAILED when gateway declines", async () => {
    const repository = createFakeRepository({
      initialCarts: {
        "cart-1": {
          id: "cart-1",
          status: "OPEN",
          items: [{ id: "i1", cartId: "cart-1", productId: "p1", quantity: 1, unitPriceCents: 1000 }],
        },
      },
    });
    const cartsService = createCartsService({
      repository,
      paymentGateway: createFakeGateway("declined"),
      promoCodeService: createFakePromoCodeService(),
    });

    const txn = await cartsService.checkout("cart-1", {});
    expect(txn.status).toBe("DECLINED");
  });

  test("rejects checkout for an unknown cart id (FR-021)", async () => {
    const repository = createFakeRepository({ initialCarts: {} });
    const cartsService = createCartsService({
      repository,
      paymentGateway: createFakeGateway("approved"),
      promoCodeService: createFakePromoCodeService(),
    });

    await expect(cartsService.checkout("nope", {})).rejects.toThrow(
      NotFoundError
    );
  });
});
