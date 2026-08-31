const request = require("supertest");
const createApp = require("../../src/app");
const prisma = require("../../src/lib/prisma");

/**
 * Integration test retrieving a transaction by id and searching/paging
 * transaction history (FR-019, FR-020).
 */
function createFixedGateway(status) {
  return {
    async submitPayment() {
      return { status, gatewayReference: `history-${status}-${Date.now()}-${Math.random()}` };
    },
    async getPaymentStatus() {
      return null;
    },
  };
}

async function checkoutNewCart(app, product, status) {
  const createRes = await request(app).post("/api/v1/carts").send();
  const cartId = createRes.body.id;
  await request(app)
    .post(`/api/v1/carts/${cartId}/items`)
    .send({ productId: product.id, quantity: 1 });
  const checkoutRes = await request(app)
    .post(`/api/v1/carts/${cartId}/checkout`)
    .send({});
  return { cartId, transaction: checkoutRes.body };
}

describe("transaction history (integration)", () => {
  let product;

  beforeAll(async () => {
    product = await prisma.product.create({
      data: { name: "History Test Item", category: "Test", priceCents: 1000 },
    });
  });

  afterAll(async () => {
    await prisma.product.delete({ where: { id: product.id } }).catch(() => {});
    await prisma.$disconnect();
  });

  test("GET /transactions/:id retrieves a transaction by id", async () => {
    const app = createApp({ paymentGateway: createFixedGateway("approved") });
    const { transaction } = await checkoutNewCart(app, product, "approved");

    const res = await request(app).get(`/api/v1/transactions/${transaction.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(transaction.id);
    expect(res.body.status).toBe("APPROVED");
  });

  test("GET /transactions/:id returns 404 for an unknown id", async () => {
    const app = createApp();
    const res = await request(app).get("/api/v1/transactions/does-not-exist");
    expect(res.status).toBe(404);
  });

  test("GET /transactions pages and filters by status", async () => {
    const appApproved = createApp({ paymentGateway: createFixedGateway("approved") });
    const appDeclined = createApp({ paymentGateway: createFixedGateway("declined") });
    await checkoutNewCart(appApproved, product, "approved");
    await checkoutNewCart(appDeclined, product, "declined");

    const res = await request(appApproved).get(
      "/api/v1/transactions?status=APPROVED&page=1&pageSize=5"
    );
    expect(res.status).toBe(200);
    expect(res.body.items.every((t) => t.status === "APPROVED")).toBe(true);
    expect(res.body).toHaveProperty("total");
  });

  test("GET /transactions filters by cartId", async () => {
    const app = createApp({ paymentGateway: createFixedGateway("approved") });
    const { cartId } = await checkoutNewCart(app, product, "approved");

    const res = await request(app).get(`/api/v1/transactions?cartId=${cartId}`);
    expect(res.status).toBe(200);
    expect(res.body.items.every((t) => t.cartId === cartId)).toBe(true);
    expect(res.body.items.length).toBeGreaterThanOrEqual(1);
  });
});
