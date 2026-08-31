const prisma = require("../lib/prisma");
const { ValidationError } = require("../errors/errorCatalog");

/**
 * Promo-code lookup/validation (active flag, expiresAt) — FR-025.
 * An invalid/unknown code causes checkout to reject with a clear error
 * rather than silently proceeding without a discount.
 *
 * @param {{ client?: import('@prisma/client').PrismaClient }} [deps]
 */
function createPromoCodeService(deps = {}) {
  const client = deps.client || prisma;

  /**
   * @param {string|undefined|null} code
   * @param {import('@prisma/client').PrismaClient} [tx] - optional transaction client
   * @returns {Promise<object|null>} the PromoCode row, or null if no code was supplied
   */
  async function validate(code, tx = client) {
    if (!code) return null;
    const promoCode = await tx.promoCode.findUnique({ where: { code } });
    if (!promoCode) {
      throw new ValidationError(`Invalid promo code: ${code}`, "INVALID_PROMO_CODE");
    }
    if (!promoCode.active) {
      throw new ValidationError(`Promo code is not active: ${code}`, "INVALID_PROMO_CODE");
    }
    if (promoCode.expiresAt && promoCode.expiresAt.getTime() < Date.now()) {
      throw new ValidationError(`Promo code has expired: ${code}`, "INVALID_PROMO_CODE");
    }
    return promoCode;
  }

  /** Compute the discount in cents for a given subtotal and promo code (null-safe). */
  function computeDiscountCents(subtotalCents, promoCode) {
    if (!promoCode) return 0;
    if (promoCode.discountType === "PERCENT") {
      return Math.round((subtotalCents * promoCode.discountValue) / 100);
    }
    if (promoCode.discountType === "FIXED") {
      return Math.min(promoCode.discountValue, subtotalCents);
    }
    return 0;
  }

  return { validate, computeDiscountCents };
}

module.exports = createPromoCodeService;
