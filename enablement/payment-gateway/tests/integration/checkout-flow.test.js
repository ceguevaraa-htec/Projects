const request = require("supertest");
const createApp = require("../../src/app");
const prisma = require("../../src/lib/prisma");

/**
 * Integration test for the checkout flow covering both an approved and a
 * declined outcome, via a test-injectable MockPaymentGateway seam, plus
 * T035b's concurrent-checkout guard.
 */
function createFixedGateway(status) {
  let counter = 0;
  return {
    async submitPayment() {
      counter += 1;
      return { status, gatewayReference: `fixed-${status}-${counter}` };
    },
    async getPaymentStatus() {
      return null;
    },
  };
}

/** A gateway that only resolves after a caller-controlled release() is called,
 * used to simulate two concurrent checkout requests racing each other. */
function createSlowGateway(status) {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  return {
    async submitPayment() {
      await gate;
      return { status, gatewayReference: `slow-${status}-${Date.now()}` };
    },
    async getPaymentStatus() {
      return null;
    },
    release: () => release(),
  };
}

async function createCartWithProduct(app, product, quantity = 1) {
  const createRes = await request(app).post("/api/v1/carts").send();
  const cartId = createRes.body.id;
  await request(app)
    .post(`/api/v1/carts/${cartId}/items`)
    .send({ productId: product.id, quantity });
  return cartId;
}

describe("checkout flow (integration)", () => {
  let product;

  beforeAll(async () => {
    product = await prisma.product.create({
      data: { name: "Checkout Test Item", category: "Test", priceCents: 2000 },
    });
  });

  afterAll(async () => {
    await prisma.product.delete({ where: { id: product.id } }).catch(() => {});
    await prisma.$disconnect();
  });

  test("approved payment sets cart status to PAID", async () => {
    const app = createApp({ paymentGateway: createFixedGateway("approved") });
    const cartId = await createCartWithProduct(app, product, 2);

    const checkoutRes = await request(app)
      .post(`/api/v1/carts/${cartId}/checkout`)
      .send({});
    expect(checkoutRes.status).toBe(200);
    expect(checkoutRes.body.status).toBe("APPROVED");
    expect(checkoutRes.body.totalCents).toBe(4000);

    const cartRes = await request(app).get(`/api/v1/carts/${cartId}`);
    expect(cartRes.body.status).toBe("PAID");
  });

  test("declined payment sets cart status to FAILED", async () => {
    const app = createApp({ paymentGateway: createFixedGateway("declined") });
    const cartId = await createCartWithProduct(app, product, 1);

    const checkoutRes = await request(app)
      .post(`/api/v1/carts/${cartId}/checkout`)
      .send({});
    expect(checkoutRes.status).toBe(200);
    expect(checkoutRes.body.status).toBe("DECLINED");

    const cartRes = await request(app).get(`/api/v1/carts/${cartId}`);
    expect(cartRes.body.status).toBe("FAILED");
  });

  test("rejects checkout of an empty cart", async () => {
    const app = createApp({ paymentGateway: createFixedGateway("approved") });
    const createRes = await request(app).post("/api/v1/carts").send();
    const cartId = createRes.body.id;

    const res = await request(app)
      .post(`/api/v1/carts/${cartId}/checkout`)
      .send({});
    expect(res.status).toBe(400);
  });

  test("rejects a second checkout of an already-Paid cart", async () => {
    const app = createApp({ paymentGateway: createFixedGateway("approved") });
    const cartId = await createCartWithProduct(app, product, 1);

    const first = await request(app)
      .post(`/api/v1/carts/${cartId}/checkout`)
      .send({});
    expect(first.status).toBe(200);

    const second = await request(app)
      .post(`/api/v1/carts/${cartId}/checkout`)
      .send({});
    expect(second.status).toBe(400);
  });

  // T035b: two concurrent checkout requests against the same cart — only
  // one may succeed (Paid/Failed); the other is rejected with no
  // duplicate Transaction row.
  test("concurrent checkout requests: only one succeeds, no duplicate transaction", async () => {
    const gateway = createSlowGateway("approved");
    const app = createApp({ paymentGateway: gateway });
    const cartId = await createCartWithProduct(app, product, 1);

    const req1 = request(app).post(`/api/v1/carts/${cartId}/checkout`).send({});
    const req2 = request(app).post(`/api/v1/carts/${cartId}/checkout`).send({});

    // Let both requests reach the payment submission step, then release.
    await new Promise((resolve) => setTimeout(resolve, 50));
    gateway.release();

    const [res1, res2] = await Promise.all([req1, req2]);
    const statuses = [res1.status, res2.status].sort();
    // Exactly one request succeeds (200); the other is rejected.
    expect(statuses).toEqual([200, 409].sort());

    const transactions = await prisma.transaction.findMany({
      where: { cartId },
    });
    expect(transactions).toHaveLength(1);
  });
});
