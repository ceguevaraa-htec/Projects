const request = require("supertest");
const createApp = require("../../src/app");
const prisma = require("../../src/lib/prisma");

/**
 * Integration test for paged/filtered/searched product listing requests
 * against the running Express app (FR-008–FR-011).
 */
describe("product search (integration)", () => {
  let app;
  const createdIds = [];

  beforeAll(async () => {
    app = createApp();
    const seedProducts = [
      { name: "Alpha Widget", category: "Gadgets", priceCents: 1000 },
      { name: "Beta Widget", category: "Gadgets", priceCents: 2000 },
      { name: "Gamma Gizmo", category: "Gadgets", priceCents: 3000 },
      { name: "Delta Shirt", category: "Apparel", priceCents: 1500 },
    ];
    for (const p of seedProducts) {
      const created = await prisma.product.create({ data: p });
      createdIds.push(created.id);
    }
  });

  afterAll(async () => {
    await prisma.product.deleteMany({ where: { id: { in: createdIds } } });
    await prisma.$disconnect();
  });

  test("GET /products pages results", async () => {
    const res = await request(app).get("/api/v1/products?page=1&pageSize=2");
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeLessThanOrEqual(2);
    expect(res.body).toHaveProperty("total");
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBe(2);
  });

  test("GET /products filters by category", async () => {
    const res = await request(app).get("/api/v1/products?category=Apparel");
    expect(res.status).toBe(200);
    expect(res.body.items.every((p) => p.category === "Apparel")).toBe(true);
  });

  test("GET /products filters by price range", async () => {
    const res = await request(app).get(
      "/api/v1/products?minPrice=1500&maxPrice=2500&category=Gadgets"
    );
    expect(res.status).toBe(200);
    expect(
      res.body.items.every((p) => p.priceCents >= 1500 && p.priceCents <= 2500)
    ).toBe(true);
  });

  test("GET /products searches by name", async () => {
    const res = await request(app).get("/api/v1/products?q=Widget");
    expect(res.status).toBe(200);
    expect(res.body.items.every((p) => p.name.includes("Widget"))).toBe(true);
  });

  test("GET /products combines filters, search, and paging", async () => {
    const res = await request(app).get(
      "/api/v1/products?category=Gadgets&q=Widget&page=1&pageSize=1"
    );
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeLessThanOrEqual(1);
  });

  test("GET /products returns 400 for invalid price range", async () => {
    const res = await request(app).get(
      "/api/v1/products?minPrice=5000&maxPrice=1000"
    );
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("errorCode");
  });

  test("GET /products/:id returns a single product", async () => {
    const res = await request(app).get(`/api/v1/products/${createdIds[0]}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(createdIds[0]);
  });

  test("GET /products/:id returns 404 for unknown id", async () => {
    const res = await request(app).get("/api/v1/products/does-not-exist");
    expect(res.status).toBe(404);
  });
});
