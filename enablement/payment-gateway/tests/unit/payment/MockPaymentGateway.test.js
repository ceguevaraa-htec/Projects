const MockPaymentGateway = require("../../../src/payment/MockPaymentGateway");

describe("MockPaymentGateway", () => {
  test("submitPayment approves when approveRate is 1 and amount is positive", async () => {
    const gateway = new MockPaymentGateway({ approveRate: 1 });
    const result = await gateway.submitPayment({
      cartId: "cart-1",
      amountCents: 1000,
    });
    expect(result.status).toBe("approved");
    expect(typeof result.gatewayReference).toBe("string");
    expect(result.gatewayReference.length).toBeGreaterThan(0);
  });

  test("submitPayment declines when approveRate is 0", async () => {
    const gateway = new MockPaymentGateway({ approveRate: 0 });
    const result = await gateway.submitPayment({
      cartId: "cart-1",
      amountCents: 1000,
    });
    expect(result.status).toBe("declined");
  });

  test("submitPayment declines a zero or negative amount regardless of approveRate", async () => {
    const gateway = new MockPaymentGateway({ approveRate: 1 });
    const zero = await gateway.submitPayment({ cartId: "c", amountCents: 0 });
    const negative = await gateway.submitPayment({
      cartId: "c",
      amountCents: -100,
    });
    expect(zero.status).toBe("declined");
    expect(negative.status).toBe("declined");
  });

  test("each submission gets a unique gatewayReference", async () => {
    const gateway = new MockPaymentGateway({ approveRate: 1 });
    const a = await gateway.submitPayment({ cartId: "c", amountCents: 100 });
    const b = await gateway.submitPayment({ cartId: "c", amountCents: 100 });
    expect(a.gatewayReference).not.toBe(b.gatewayReference);
  });

  test("getPaymentStatus returns the previously recorded result", async () => {
    const gateway = new MockPaymentGateway({ approveRate: 1 });
    const submitted = await gateway.submitPayment({
      cartId: "c",
      amountCents: 100,
    });
    const status = await gateway.getPaymentStatus(submitted.gatewayReference);
    expect(status).toEqual(submitted);
  });

  test("getPaymentStatus returns null for an unknown reference", async () => {
    const gateway = new MockPaymentGateway();
    const status = await gateway.getPaymentStatus("unknown-ref");
    expect(status).toBeNull();
  });
});
