const request = require("supertest");
const createApp = require("../../src/app");
const prisma = require("../../src/lib/prisma");

/**
 * Contract tests: assert request/response shapes for every endpoint match
 * contracts/openapi.yaml, including the centralized error envelope shape
 * (constitution Principle II).
 */
function expectErrorEnvelope(body, expectedStatus) {
  expect(body).toEqual(
    expect.objectContaining({
      statusCode: expectedStatus,
      errorCode: expect.any(String),
      message: expect.any(String),
    })
  );
  expect(body).toHaveProperty("requestId");
}

function createFixedGateway(status) {
  return {
    async submitPayment() {
      return {
        status,
        gatewayReference: `contract-${status}-${Date.now()}-${Math.random()}`,
      };
    },
    async getPaymentStatus() {
      return null;
    },
  };
}

describe("OpenAPI contract", () => {
  let app;
  let product;

  beforeAll(async () => {
    app = createApp({ paymentGateway: createFixedGateway("approved") });
    product = await prisma.product.create({
      data: { name: "Contract Test Product", category: "Contract", priceCents: 999 },
    });
  });

  afterAll(async () => {
    await prisma.product.delete({ where: { id: product.id } }).catch(() => {});
    await prisma.$disconnect();
  });

  test("GET /products matches PagedProducts schema", async () => {
    const res = await request(app).get("/api/v1/products");
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        items: expect.any(Array),
        page: expect.any(Number),
        pageSize: expect.any(Number),
        total: expect.any(Number),
      })
    );
    if (res.body.items.length > 0) {
      expect(res.body.items[0]).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          name: expect.any(String),
          category: expect.any(String),
          priceCents: expect.any(Number),
        })
      );
    }
  });

  test("GET /products/:productId matches Product schema", async () => {
    const res = await request(app).get(`/api/v1/products/${product.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        id: product.id,
        name: product.name,
        category: product.category,
        priceCents: product.priceCents,
      })
    );
  });

  test("GET /products/:productId (missing) matches ErrorResponse schema", async () => {
    const res = await request(app).get("/api/v1/products/does-not-exist");
    expectErrorEnvelope(res.body, 404);
  });

  test("POST /carts matches Cart schema, status 201", async () => {
    const res = await request(app).post("/api/v1/carts").send();
    expect(res.status).toBe(201);
    expect(res.body).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        status: "OPEN",
        items: [],
        subtotalCents: 0,
      })
    );
  });

  test("full Cart contract shape after adding an item", async () => {
    const createRes = await request(app).post("/api/v1/carts").send();
    const cartId = createRes.body.id;
    const res = await request(app)
      .post(`/api/v1/carts/${cartId}/items`)
      .send({ productId: product.id, quantity: 2 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        id: cartId,
        status: "OPEN",
        items: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            productId: product.id,
            quantity: 2,
            unitPriceCents: product.priceCents,
            lineTotalCents: product.priceCents * 2,
          }),
        ]),
        subtotalCents: product.priceCents * 2,
      })
    );
  });

  test("GET /carts/:cartId (missing) matches ErrorResponse schema", async () => {
    const res = await request(app).get("/api/v1/carts/does-not-exist");
    expectErrorEnvelope(res.body, 404);
  });

  test("POST /carts/:cartId/checkout matches Transaction schema", async () => {
    const createRes = await request(app).post("/api/v1/carts").send();
    const cartId = createRes.body.id;
    await request(app)
      .post(`/api/v1/carts/${cartId}/items`)
      .send({ productId: product.id, quantity: 1 });
    const res = await request(app)
      .post(`/api/v1/carts/${cartId}/checkout`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        cartId,
        status: expect.stringMatching(/^(APPROVED|DECLINED)$/),
        totalCents: expect.any(Number),
        discountCents: expect.any(Number),
        createdAt: expect.any(String),
      })
    );
  });

  test("GET /transactions matches PagedTransactions schema", async () => {
    const res = await request(app).get("/api/v1/transactions");
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        items: expect.any(Array),
        page: expect.any(Number),
        pageSize: expect.any(Number),
        total: expect.any(Number),
      })
    );
  });

  test("GET /transactions/:transactionId (missing) matches ErrorResponse schema", async () => {
    const res = await request(app).get("/api/v1/transactions/does-not-exist");
    expectErrorEnvelope(res.body, 404);
  });

  test("400 responses (validation) match ErrorResponse schema", async () => {
    const createRes = await request(app).post("/api/v1/carts").send();
    const cartId = createRes.body.id;
    const res = await request(app)
      .post(`/api/v1/carts/${cartId}/items`)
      .send({ productId: product.id, quantity: 0 });
    expectErrorEnvelope(res.body, 400);
  });
});
