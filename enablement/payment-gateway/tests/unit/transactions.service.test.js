const { ValidationError, NotFoundError } = require("../../src/errors/errorCatalog");
const createTransactionsService = require("../../src/transactions/transactions.service");

/**
 * Unit tests for transactions.service.js — lookup-by-id, status/cart
 * filtering, and paging (FR-019, FR-020).
 */
function createFakeTransactionsRepository(transactions) {
  return {
    async findById(id) {
      return transactions.find((t) => t.id === id) || null;
    },
    async findMany({ page, pageSize, status, cartId }) {
      let filtered = transactions.slice();
      if (status) filtered = filtered.filter((t) => t.status === status);
      if (cartId) filtered = filtered.filter((t) => t.cartId === cartId);
      const total = filtered.length;
      const start = (page - 1) * pageSize;
      const items = filtered.slice(start, start + pageSize);
      return { items, total };
    },
  };
}

const SAMPLE_TRANSACTIONS = [
  { id: "t1", cartId: "cart-1", status: "APPROVED", totalCents: 1000, discountCents: 0, createdAt: new Date() },
  { id: "t2", cartId: "cart-2", status: "DECLINED", totalCents: 2000, discountCents: 0, createdAt: new Date() },
  { id: "t3", cartId: "cart-1", status: "APPROVED", totalCents: 1500, discountCents: 100, createdAt: new Date() },
];

describe("transactions.service", () => {
  let repo;
  let transactionsService;

  beforeEach(() => {
    repo = createFakeTransactionsRepository(SAMPLE_TRANSACTIONS);
    transactionsService = createTransactionsService({ repository: repo });
  });

  test("getTransaction returns a transaction by id (FR-019)", async () => {
    const txn = await transactionsService.getTransaction("t1");
    expect(txn.id).toBe("t1");
  });

  test("getTransaction throws NotFoundError for an unknown id (FR-021)", async () => {
    await expect(transactionsService.getTransaction("nope")).rejects.toThrow(
      NotFoundError
    );
  });

  test("listTransactions pages results (FR-020)", async () => {
    const result = await transactionsService.listTransactions({
      page: 1,
      pageSize: 2,
    });
    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(3);
  });

  test("listTransactions filters by status (FR-020)", async () => {
    const result = await transactionsService.listTransactions({
      status: "APPROVED",
    });
    expect(result.items.every((t) => t.status === "APPROVED")).toBe(true);
    expect(result.total).toBe(2);
  });

  test("listTransactions filters by cartId (FR-020)", async () => {
    const result = await transactionsService.listTransactions({
      cartId: "cart-1",
    });
    expect(result.items.every((t) => t.cartId === "cart-1")).toBe(true);
    expect(result.total).toBe(2);
  });

  test("listTransactions rejects a negative page number", async () => {
    await expect(
      transactionsService.listTransactions({ page: -1 })
    ).rejects.toThrow(ValidationError);
  });

  test("listTransactions rejects an unknown status value", async () => {
    await expect(
      transactionsService.listTransactions({ status: "BOGUS" })
    ).rejects.toThrow(ValidationError);
  });
});
