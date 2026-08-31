const request = require("supertest");
const createApp = require("../../src/app");
const prisma = require("../../src/lib/prisma");

/**
 * Integration test for the full cart lifecycle against the running Express
 * app: create -> add -> add duplicate (merge) -> update -> remove -> retrieve.
 */
describe("cart lifecycle (integration)", () => {
  let app;
  let product;

  beforeAll(async () => {
    app = createApp();
    product = await prisma.product.create({
      data: {
        name: "Integration Test Widget",
        category: "Test",
        priceCents: 1500,
      },
    });
  });

  afterAll(async () => {
    await prisma.product.delete({ where: { id: product.id } }).catch(() => {});
    await prisma.$disconnect();
  });

  test("full cart lifecycle", async () => {
    // Create cart
    const createRes = await request(app).post("/api/v1/carts").send();
    expect(createRes.status).toBe(201);
    expect(createRes.body.status).toBe("OPEN");
    const cartId = createRes.body.id;

    // Add product with quantity 2
    const addRes = await request(app)
      .post(`/api/v1/carts/${cartId}/items`)
      .send({ productId: product.id, quantity: 2 });
    expect(addRes.status).toBe(200);
    expect(addRes.body.items).toHaveLength(1);
    expect(addRes.body.items[0].quantity).toBe(2);

    // Add same product again -> quantity merges to 5
    const addAgainRes = await request(app)
      .post(`/api/v1/carts/${cartId}/items`)
      .send({ productId: product.id, quantity: 3 });
    expect(addAgainRes.status).toBe(200);
    expect(addAgainRes.body.items).toHaveLength(1);
    expect(addAgainRes.body.items[0].quantity).toBe(5);
    const itemId = addAgainRes.body.items[0].id;

    // Update quantity
    const updateRes = await request(app)
      .patch(`/api/v1/carts/${cartId}/items/${itemId}`)
      .send({ quantity: 10 });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.items[0].quantity).toBe(10);

    // Retrieve cart, confirm running total
    const getRes = await request(app).get(`/api/v1/carts/${cartId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.subtotalCents).toBe(15000);

    // Remove item
    const removeRes = await request(app).delete(
      `/api/v1/carts/${cartId}/items/${itemId}`
    );
    expect(removeRes.status).toBe(200);
    expect(removeRes.body.items).toHaveLength(0);

    // Retrieve final state
    const finalRes = await request(app).get(`/api/v1/carts/${cartId}`);
    expect(finalRes.body.items).toHaveLength(0);
    expect(finalRes.body.subtotalCents).toBe(0);
  });

  test("returns 400 for zero/negative quantity", async () => {
    const createRes = await request(app).post("/api/v1/carts").send();
    const cartId = createRes.body.id;
    const res = await request(app)
      .post(`/api/v1/carts/${cartId}/items`)
      .send({ productId: product.id, quantity: 0 });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("errorCode");
    expect(res.body).toHaveProperty("requestId");
  });

  test("returns 404 for a nonexistent cart", async () => {
    const res = await request(app).get("/api/v1/carts/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("errorCode");
  });
});
