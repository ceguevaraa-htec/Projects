const request = require("supertest");
const createApp = require("../../src/app");
const prisma = require("../../src/lib/prisma");

/**
 * Edge-case coverage per spec.md's Edge Cases section (T045): invalid
 * product id on add, zero/negative quantity, updating/removing a missing
 * line item, retrieving a nonexistent cart/transaction, and invalid
 * paging/filter params (negative page, minPrice > maxPrice).
 */
describe("edge cases (integration)", () => {
  let app;
  let product;

  beforeAll(async () => {
    app = createApp();
    product = await prisma.product.create({
      data: { name: "Edge Case Item", category: "Test", priceCents: 500 },
    });
  });

  afterAll(async () => {
    await prisma.product.delete({ where: { id: product.id } }).catch(() => {});
    await prisma.$disconnect();
  });

  test("adding a nonexistent product id returns 404", async () => {
    const createRes = await request(app).post("/api/v1/carts").send();
    const res = await request(app)
      .post(`/api/v1/carts/${createRes.body.id}/items`)
      .send({ productId: "does-not-exist", quantity: 1 });
    expect(res.status).toBe(404);
  });

  test("adding with negative quantity returns 400", async () => {
    const createRes = await request(app).post("/api/v1/carts").send();
    const res = await request(app)
      .post(`/api/v1/carts/${createRes.body.id}/items`)
      .send({ productId: product.id, quantity: -5 });
    expect(res.status).toBe(400);
  });

  test("setting a line item's quantity to zero returns 400", async () => {
    const createRes = await request(app).post("/api/v1/carts").send();
    const cartId = createRes.body.id;
    const addRes = await request(app)
      .post(`/api/v1/carts/${cartId}/items`)
      .send({ productId: product.id, quantity: 1 });
    const itemId = addRes.body.items[0].id;
    const res = await request(app)
      .patch(`/api/v1/carts/${cartId}/items/${itemId}`)
      .send({ quantity: 0 });
    expect(res.status).toBe(400);
  });

  test("updating a line item that is not in the cart returns 404", async () => {
    const createRes = await request(app).post("/api/v1/carts").send();
    const res = await request(app)
      .patch(`/api/v1/carts/${createRes.body.id}/items/does-not-exist`)
      .send({ quantity: 2 });
    expect(res.status).toBe(404);
  });

  test("removing a line item that is not in the cart returns 404", async () => {
    const createRes = await request(app).post("/api/v1/carts").send();
    const res = await request(app).delete(
      `/api/v1/carts/${createRes.body.id}/items/does-not-exist`
    );
    expect(res.status).toBe(404);
  });

  test("retrieving a nonexistent cart returns 404", async () => {
    const res = await request(app).get("/api/v1/carts/does-not-exist");
    expect(res.status).toBe(404);
  });

  test("updating an item on a nonexistent cart returns 404", async () => {
    const res = await request(app)
      .patch("/api/v1/carts/does-not-exist/items/some-item")
      .send({ quantity: 1 });
    expect(res.status).toBe(404);
  });

  test("checking out a nonexistent cart returns 404", async () => {
    const res = await request(app)
      .post("/api/v1/carts/does-not-exist/checkout")
      .send({});
    expect(res.status).toBe(404);
  });

  test("retrieving a nonexistent transaction returns 404", async () => {
    const res = await request(app).get("/api/v1/transactions/does-not-exist");
    expect(res.status).toBe(404);
  });

  test("negative page number on product listing returns 400", async () => {
    const res = await request(app).get("/api/v1/products?page=-1");
    expect(res.status).toBe(400);
  });

  test("minPrice greater than maxPrice on product listing returns 400", async () => {
    const res = await request(app).get(
      "/api/v1/products?minPrice=9999&maxPrice=1"
    );
    expect(res.status).toBe(400);
  });

  test("negative page number on transaction listing returns 400", async () => {
    const res = await request(app).get("/api/v1/transactions?page=-1");
    expect(res.status).toBe(400);
  });

  test("unknown status filter on transaction listing returns 400", async () => {
    const res = await request(app).get("/api/v1/transactions?status=BOGUS");
    expect(res.status).toBe(400);
  });

  test("checking out an empty cart returns 400 with no transaction created", async () => {
    const createRes = await request(app).post("/api/v1/carts").send();
    const cartId = createRes.body.id;
    const res = await request(app)
      .post(`/api/v1/carts/${cartId}/checkout`)
      .send({});
    expect(res.status).toBe(400);
    const transactions = await prisma.transaction.findMany({
      where: { cartId },
    });
    expect(transactions).toHaveLength(0);
  });

  test("checking out a cart with an invalid promo code returns 400", async () => {
    const createRes = await request(app).post("/api/v1/carts").send();
    const cartId = createRes.body.id;
    await request(app)
      .post(`/api/v1/carts/${cartId}/items`)
      .send({ productId: product.id, quantity: 1 });
    const res = await request(app)
      .post(`/api/v1/carts/${cartId}/checkout`)
      .send({ promoCode: "NOT_A_REAL_CODE" });
    expect(res.status).toBe(400);
  });
});
