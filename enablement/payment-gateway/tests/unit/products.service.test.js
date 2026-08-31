const { ValidationError, NotFoundError } = require("../../src/errors/errorCatalog");
const createProductsService = require("../../src/products/products.service");

/**
 * Unit tests for products.service.js — filtering (category, price range),
 * search (name match), paging, and combined-parameter queries
 * (FR-008–FR-011).
 */
function createFakeProductsRepository(products) {
  return {
    async findMany({ page, pageSize, q, category, minPrice, maxPrice }) {
      let filtered = products.slice();
      if (q) {
        const needle = q.toLowerCase();
        filtered = filtered.filter((p) => p.name.toLowerCase().includes(needle));
      }
      if (category) {
        filtered = filtered.filter((p) => p.category === category);
      }
      if (minPrice != null) {
        filtered = filtered.filter((p) => p.priceCents >= minPrice);
      }
      if (maxPrice != null) {
        filtered = filtered.filter((p) => p.priceCents <= maxPrice);
      }
      const total = filtered.length;
      const start = (page - 1) * pageSize;
      const items = filtered.slice(start, start + pageSize);
      return { items, total };
    },
    async findById(id) {
      return products.find((p) => p.id === id) || null;
    },
  };
}

const SAMPLE_PRODUCTS = [
  { id: "p1", name: "Blue Phone Case", category: "Electronics", priceCents: 1500 },
  { id: "p2", name: "Red Phone Case", category: "Electronics", priceCents: 1800 },
  { id: "p3", name: "Wireless Headphones", category: "Electronics", priceCents: 5000 },
  { id: "p4", name: "Running Shoes", category: "Apparel", priceCents: 7000 },
  { id: "p5", name: "Cotton Shirt", category: "Apparel", priceCents: 2000 },
];

describe("products.service", () => {
  let repo;
  let productsService;

  beforeEach(() => {
    repo = createFakeProductsRepository(SAMPLE_PRODUCTS);
    productsService = createProductsService({ repository: repo });
  });

  test("listProducts pages results (FR-008)", async () => {
    const result = await productsService.listProducts({ page: 1, pageSize: 2 });
    expect(result.items).toHaveLength(2);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(2);
    expect(result.total).toBe(5);
  });

  test("listProducts filters by category (FR-009)", async () => {
    const result = await productsService.listProducts({ category: "Apparel" });
    expect(result.items.every((p) => p.category === "Apparel")).toBe(true);
    expect(result.total).toBe(2);
  });

  test("listProducts filters by price range (FR-009)", async () => {
    const result = await productsService.listProducts({
      minPrice: 1600,
      maxPrice: 5000,
    });
    expect(result.items.map((p) => p.id).sort()).toEqual(["p2", "p3", "p5"]);
  });

  test("listProducts searches by name (FR-010)", async () => {
    const result = await productsService.listProducts({ q: "phone case" });
    expect(result.items.map((p) => p.id).sort()).toEqual(["p1", "p2"]);
  });

  test("listProducts combines search, filter, and paging (FR-011)", async () => {
    const result = await productsService.listProducts({
      category: "Electronics",
      q: "case",
      page: 1,
      pageSize: 1,
    });
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(2);
  });

  test("listProducts rejects negative page number", async () => {
    await expect(
      productsService.listProducts({ page: -1 })
    ).rejects.toThrow(ValidationError);
  });

  test("listProducts rejects minPrice > maxPrice", async () => {
    await expect(
      productsService.listProducts({ minPrice: 5000, maxPrice: 1000 })
    ).rejects.toThrow(ValidationError);
  });

  test("getProduct returns a product by id", async () => {
    const product = await productsService.getProduct("p1");
    expect(product.id).toBe("p1");
  });

  test("getProduct throws NotFoundError for an unknown id (FR-021)", async () => {
    await expect(productsService.getProduct("nope")).rejects.toThrow(
      NotFoundError
    );
  });
});
