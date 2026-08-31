/**
 * PaymentGateway interface (contract only — no concrete logic).
 *
 * Cart/checkout services MUST depend only on this interface (constructor/
 * parameter injection), never `require`ing a concrete implementation
 * (e.g. MockPaymentGateway) directly. This keeps the mock swappable for a
 * real payment provider without touching cart/checkout code
 * (constitution Principle V).
 *
 * @typedef {Object} PaymentRequest
 * @property {string} cartId
 * @property {number} amountCents
 *
 * @typedef {Object} PaymentResult
 * @property {'approved'|'declined'} status
 * @property {string} gatewayReference - opaque id assigned by the gateway
 *
 * @interface PaymentGateway
 */
class PaymentGateway {
  /**
   * Submit a payment request to the gateway.
   * @param {PaymentRequest} request
   * @returns {Promise<PaymentResult>}
   */
  // eslint-disable-next-line no-unused-vars
  async submitPayment(request) {
    throw new Error("PaymentGateway.submitPayment must be implemented");
  }

  /**
   * Look up the status of a previously submitted payment.
   * @param {string} gatewayReference
   * @returns {Promise<PaymentResult>}
   */
  // eslint-disable-next-line no-unused-vars
  async getPaymentStatus(gatewayReference) {
    throw new Error("PaymentGateway.getPaymentStatus must be implemented");
  }
}

module.exports = PaymentGateway;
