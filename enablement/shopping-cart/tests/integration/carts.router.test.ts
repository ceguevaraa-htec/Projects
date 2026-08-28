import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";

function app() {
  return createApp();
}

async function createCart(a: ReturnType<typeof app>) {
  const res = await request(a).post("/carts");
  return res.body.id as string;
}

describe("POST /carts, POST /carts/:cartId/items, GET /carts/:cartId (User Story 1)", () => {
  it("POST /carts returns 201 and an empty open cart", async () => {
    const a = app();
    const res = await request(a).post("/carts");
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: "open", items: [], totalPrice: 0 });
    expect(res.body.id).toBeTruthy();
  });

  it("POST /carts/:cartId/items adds an item and returns 200 with the updated cart", async () => {
    const a = app();
    const cartId = await createCart(a);
    const res = await request(a)
      .post(`/carts/${cartId}/items`)
      .send({ productId: "sku-1", quantity: 2, price: 9.99 });
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([{ productId: "sku-1", quantity: 2, price: 9.99 }]);
    expect(res.body.totalPrice).toBeCloseTo(19.98);
  });

  it("adding the same productId again merges quantity and overwrites price", async () => {
    const a = app();
    const cartId = await createCart(a);
    await request(a).post(`/carts/${cartId}/items`).send({ productId: "sku-1", quantity: 2, price: 9.99 });
    const res = await request(a)
      .post(`/carts/${cartId}/items`)
      .send({ productId: "sku-1", quantity: 1, price: 8.99 });
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([{ productId: "sku-1", quantity: 3, price: 8.99 }]);
  });

  it("POST /carts/:cartId/items returns 400 on invalid quantity or price", async () => {
    const a = app();
    const cartId = await createCart(a);
    const badQty = await request(a)
      .post(`/carts/${cartId}/items`)
      .send({ productId: "sku-1", quantity: 0, price: 1 });
    expect(badQty.status).toBe(400);

    const badPrice = await request(a)
      .post(`/carts/${cartId}/items`)
      .send({ productId: "sku-1", quantity: 1, price: -1 });
    expect(badPrice.status).toBe(400);
  });

  it("GET /carts/:cartId returns 200 with items, status, and total", async () => {
    const a = app();
    const cartId = await createCart(a);
    await request(a).post(`/carts/${cartId}/items`).send({ productId: "sku-1", quantity: 1, price: 5 });
    const res = await request(a).get(`/carts/${cartId}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "open", totalPrice: 5 });
  });

  it("returns 404 for an unknown cart id on add and get", async () => {
    const a = app();
    const addRes = await request(a)
      .post("/carts/does-not-exist/items")
      .send({ productId: "sku-1", quantity: 1, price: 1 });
    expect(addRes.status).toBe(404);

    const getRes = await request(a).get("/carts/does-not-exist");
    expect(getRes.status).toBe(404);
  });
});

describe("PATCH /carts/:cartId/items/:productId, DELETE .../items/:productId (User Story 2)", () => {
  it("PATCH updates quantity and recalculates the total", async () => {
    const a = app();
    const cartId = await createCart(a);
    await request(a).post(`/carts/${cartId}/items`).send({ productId: "sku-1", quantity: 2, price: 10 });
    const res = await request(a).patch(`/carts/${cartId}/items/sku-1`).send({ quantity: 5 });
    expect(res.status).toBe(200);
    expect(res.body.totalPrice).toBe(50);
  });

  it("PATCH with quantity 0 removes the item", async () => {
    const a = app();
    const cartId = await createCart(a);
    await request(a).post(`/carts/${cartId}/items`).send({ productId: "sku-1", quantity: 2, price: 10 });
    const res = await request(a).patch(`/carts/${cartId}/items/sku-1`).send({ quantity: 0 });
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });

  it("PATCH with a negative quantity returns 400", async () => {
    const a = app();
    const cartId = await createCart(a);
    await request(a).post(`/carts/${cartId}/items`).send({ productId: "sku-1", quantity: 2, price: 10 });
    const res = await request(a).patch(`/carts/${cartId}/items/sku-1`).send({ quantity: -1 });
    expect(res.status).toBe(400);
  });

  it("DELETE removes an item and recalculates the total", async () => {
    const a = app();
    const cartId = await createCart(a);
    await request(a).post(`/carts/${cartId}/items`).send({ productId: "sku-1", quantity: 1, price: 10 });
    const res = await request(a).delete(`/carts/${cartId}/items/sku-1`);
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.totalPrice).toBe(0);
  });

  it("returns 404 for an unknown cart id or unknown product id", async () => {
    const a = app();
    const cartId = await createCart(a);
    const unknownCart = await request(a).patch("/carts/does-not-exist/items/sku-1").send({ quantity: 1 });
    expect(unknownCart.status).toBe(404);

    const unknownProduct = await request(a).delete(`/carts/${cartId}/items/unknown-sku`);
    expect(unknownProduct.status).toBe(404);
  });
});

describe("POST /carts/:cartId/checkout, POST /carts/:cartId/clear (User Story 3)", () => {
  it("checkout returns 200 with an emptied, finalized cart", async () => {
    const a = app();
    const cartId = await createCart(a);
    await request(a).post(`/carts/${cartId}/items`).send({ productId: "sku-1", quantity: 1, price: 10 });
    const res = await request(a).post(`/carts/${cartId}/checkout`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "checked_out", items: [], totalPrice: 0 });
  });

  it("checkout on an empty cart returns 409", async () => {
    const a = app();
    const cartId = await createCart(a);
    const res = await request(a).post(`/carts/${cartId}/checkout`);
    expect(res.status).toBe(409);
  });

  it("clear returns 200 with an emptied, still-open cart", async () => {
    const a = app();
    const cartId = await createCart(a);
    await request(a).post(`/carts/${cartId}/items`).send({ productId: "sku-1", quantity: 1, price: 10 });
    const res = await request(a).post(`/carts/${cartId}/clear`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "open", items: [], totalPrice: 0 });
  });

  it("any mutating request against an already-checked-out cart returns 409", async () => {
    const a = app();
    const cartId = await createCart(a);
    await request(a).post(`/carts/${cartId}/items`).send({ productId: "sku-1", quantity: 1, price: 10 });
    await request(a).post(`/carts/${cartId}/checkout`);

    const add = await request(a)
      .post(`/carts/${cartId}/items`)
      .send({ productId: "sku-2", quantity: 1, price: 1 });
    expect(add.status).toBe(409);

    const update = await request(a).patch(`/carts/${cartId}/items/sku-1`).send({ quantity: 1 });
    expect(update.status).toBe(409);

    const del = await request(a).delete(`/carts/${cartId}/items/sku-1`);
    expect(del.status).toBe(409);

    const checkoutAgain = await request(a).post(`/carts/${cartId}/checkout`);
    expect(checkoutAgain.status).toBe(409);

    const clear = await request(a).post(`/carts/${cartId}/clear`);
    expect(clear.status).toBe(409);
  });

  it("returns 404 for an unknown cart id on checkout and clear", async () => {
    const a = app();
    const checkoutRes = await request(a).post("/carts/does-not-exist/checkout");
    expect(checkoutRes.status).toBe(404);

    const clearRes = await request(a).post("/carts/does-not-exist/clear");
    expect(clearRes.status).toBe(404);
  });
});

describe("No authentication required (FR-016)", () => {
  it("a request with no Authorization header or token still succeeds", async () => {
    const a = app();
    const createRes = await request(a).post("/carts");
    expect(createRes.status).toBe(201);

    const getRes = await request(a).get(`/carts/${createRes.body.id}`);
    expect(getRes.status).toBe(200);
  });
});
