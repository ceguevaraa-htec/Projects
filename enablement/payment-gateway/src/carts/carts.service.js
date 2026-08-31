const createCartsRepository = require("./carts.repository");
const createPromoCodeService = require("./promoCode.service");
const { logger } = require("../logging/logger");
const {
  ValidationError,
  NotFoundError,
  ConflictError,
} = require("../errors/errorCatalog");

/**
 * Cart business logic: create/add/update/remove items, compute totals, and
 * checkout orchestration. Depends only on the PaymentGateway interface
 * (constructor injection) — never requires MockPaymentGateway directly
 * (constitution Principle V).
 *
 * @param {{ repository?: ReturnType<typeof createCartsRepository>, paymentGateway?: import('../payment/PaymentGateway'), promoCodeService?: ReturnType<typeof createPromoCodeService>, log?: typeof logger }} [deps]
 */
function createCartsService(deps = {}) {
  const repository = deps.repository || createCartsRepository();
  const paymentGateway = deps.paymentGateway || null;
  const promoCodeService = deps.promoCodeService || createPromoCodeService();
  const log = deps.log || logger;

  function computeSubtotalCents(items) {
    return items.reduce(
      (sum, item) => sum + item.quantity * item.unitPriceCents,
      0
    );
  }

  function toCartView(cart) {
    const items = (cart.items || []).map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.product ? item.product.name : undefined,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      lineTotalCents: item.quantity * item.unitPriceCents,
    }));
    return {
      id: cart.id,
      status: cart.status,
      items,
      subtotalCents: computeSubtotalCents(cart.items || []),
      discountCents: cart.discountCents != null ? cart.discountCents : null,
      totalCents: cart.totalCents != null ? cart.totalCents : null,
    };
  }

  function assertPositiveQuantity(quantity) {
    if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity <= 0) {
      throw new ValidationError(
        "Quantity must be a positive integer",
        "INVALID_QUANTITY"
      );
    }
  }

  async function requireCart(cartId) {
    const cart = await repository.findCartById(cartId);
    if (!cart) {
      throw new NotFoundError(`Cart ${cartId} not found`, "CART_NOT_FOUND");
    }
    return cart;
  }

  async function createCart() {
    const cart = await repository.createCart();
    log.info({ cartId: cart.id }, "cart created");
    return toCartView(cart);
  }

  async function getCart(cartId) {
    const cart = await requireCart(cartId);
    return toCartView(cart);
  }

  async function addItem(cartId, productId, quantity) {
    assertPositiveQuantity(quantity);
    await requireCart(cartId);
    const product = await repository.findProductById(productId);
    if (!product) {
      throw new NotFoundError(
        `Product ${productId} not found`,
        "PRODUCT_NOT_FOUND"
      );
    }
    const cart = await repository.upsertItem(
      cartId,
      productId,
      quantity,
      product.priceCents
    );
    log.info(
      { cartId, productId, quantity },
      "cart item added (quantity merged if already present)"
    );
    return toCartView(cart);
  }

  async function updateItemQuantity(cartId, itemId, quantity) {
    assertPositiveQuantity(quantity);
    await requireCart(cartId);
    const item = await repository.findItem(cartId, itemId);
    if (!item) {
      throw new NotFoundError(`Cart item ${itemId} not found`, "ITEM_NOT_FOUND");
    }
    const cart = await repository.updateItemQuantity(cartId, itemId, quantity);
    log.info({ cartId, itemId, quantity }, "cart item quantity updated");
    return toCartView(cart);
  }

  async function removeItem(cartId, itemId) {
    await requireCart(cartId);
    const item = await repository.findItem(cartId, itemId);
    if (!item) {
      throw new NotFoundError(`Cart item ${itemId} not found`, "ITEM_NOT_FOUND");
    }
    const cart = await repository.deleteItem(cartId, itemId);
    log.info({ cartId, itemId }, "cart item removed");
    return toCartView(cart);
  }

  /**
   * Checkout a cart (FR-012–FR-017, FR-025): compute the final total
   * (with optional promo-code discount), submit payment through the
   * injected PaymentGateway, and record the outcome — all inside a single
   * prisma.$transaction so the payment result and cart status/Transaction
   * row are never inconsistent (constitution Principle III).
   *
   * @param {string} cartId
   * @param {{ promoCode?: string }} [options]
   */
  async function checkout(cartId, options = {}) {
    const { promoCode } = options;
    if (!paymentGateway) {
      throw new Error("checkout requires a PaymentGateway to be injected");
    }

    const cart = await requireCart(cartId);

    if (!cart.items || cart.items.length === 0) {
      throw new ValidationError(
        "Cannot check out an empty cart",
        "EMPTY_CART"
      );
    }

    // FR-017: a cart already in a final status is rejected up front with a
    // 400 (per contracts/openapi.yaml). T035a's re-check inside the
    // transaction below covers the *concurrent* race (status changed
    // between this check and the transaction starting) and uses 409
    // instead, since that is a different failure mode.
    if (cart.status !== "OPEN") {
      throw new ValidationError(
        `Cart ${cartId} is not open for checkout (status: ${cart.status})`,
        "CART_NOT_OPEN"
      );
    }

    const promo = await promoCodeService.validate(promoCode);
    const subtotalCents = computeSubtotalCents(cart.items);
    const discountCents = promoCodeService.computeDiscountCents(
      subtotalCents,
      promo
    );
    const totalCents = Math.max(subtotalCents - discountCents, 0);

    log.info({ cartId, subtotalCents, discountCents, totalCents }, "checkout attempt started");

    const transaction = await repository.runTransaction(async (tx) => {
      // T035a: re-read cart status inside the transaction immediately
      // before submitting payment, to guard against a concurrent checkout
      // of the same cart having already changed its status.
      const freshCart = await repository.findCartById(cartId, tx);
      if (!freshCart) {
        throw new NotFoundError(`Cart ${cartId} not found`, "CART_NOT_FOUND");
      }
      if (freshCart.status !== "OPEN") {
        throw new ConflictError(
          `Cart ${cartId} is no longer open for checkout`,
          "CART_NOT_OPEN"
        );
      }

      log.info({ cartId, totalCents }, "submitting payment to gateway");
      const paymentResult = await paymentGateway.submitPayment({
        cartId,
        amountCents: totalCents,
      });
      const txnStatus = paymentResult.status === "approved" ? "APPROVED" : "DECLINED";
      const cartStatus = txnStatus === "APPROVED" ? "PAID" : "FAILED";

      await repository.updateCartStatus(
        cartId,
        { status: cartStatus, discountCents, totalCents },
        tx
      );
      const txn = await repository.createTransaction(
        {
          cartId,
          status: txnStatus,
          totalCents,
          discountCents,
          promoCodeId: promo ? promo.id : null,
          gatewayReference: paymentResult.gatewayReference,
        },
        tx
      );

      log.info(
        { cartId, transactionId: txn.id, outcome: txnStatus },
        "payment result recorded"
      );
      return txn;
    });

    return transaction;
  }

  return {
    createCart,
    getCart,
    addItem,
    updateItemQuantity,
    removeItem,
    checkout,
    // exposed for reuse/testing
    _repository: repository,
    _paymentGateway: paymentGateway,
    _toCartView: toCartView,
    _computeSubtotalCents: computeSubtotalCents,
  };
}

module.exports = createCartsService;
