const { randomUUID } = require("crypto");
const PaymentGateway = require("./PaymentGateway");

/**
 * Sole concrete implementation of PaymentGateway for this feature. Simulates
 * approve/decline decisioning with no real card network or external
 * processor involved. The exact simulation rule is an internal detail of
 * this mock (per spec.md Assumptions).
 */
class MockPaymentGateway extends PaymentGateway {
  /**
   * @param {{ approveRate?: number }} [options] - approveRate in [0,1], default 0.9
   */
  constructor(options = {}) {
    super();
    this.approveRate =
      typeof options.approveRate === "number" ? options.approveRate : 0.9;
    this._results = new Map();
  }

  async submitPayment(request) {
    const gatewayReference = `mock_${randomUUID()}`;
    // Amount of exactly 0 or a negative amount is never approved; otherwise
    // simulate approve/decline randomly at the configured approve rate.
    const approved =
      request &&
      typeof request.amountCents === "number" &&
      request.amountCents > 0 &&
      Math.random() < this.approveRate;
    const result = {
      status: approved ? "approved" : "declined",
      gatewayReference,
    };
    this._results.set(gatewayReference, result);
    return result;
  }

  async getPaymentStatus(gatewayReference) {
    return this._results.get(gatewayReference) || null;
  }
}

module.exports = MockPaymentGateway;
